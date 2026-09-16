CREATE OR REPLACE FUNCTION public.settle_demo_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_exit_price NUMERIC
)
RETURNS SETOF public.trades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_trade public.trades;
  current_balance NUMERIC(18,2);
  credit NUMERIC(18,2) := 0;
  result_status TEXT;
  result_pnl NUMERIC(18,2) := 0;
  effective_exit_price NUMERIC;
  simulated_win BOOLEAN;
BEGIN
  SELECT * INTO target_trade
  FROM public.trades
  WHERE id = p_trade_id
    AND user_id = p_user_id
    AND account_mode = 'demo'
  FOR UPDATE;

  IF target_trade.id IS NULL THEN
    RAISE EXCEPTION 'Trade unavailable';
  END IF;

  IF target_trade.status <> 'open' THEN
    RETURN NEXT target_trade;
    RETURN;
  END IF;

  SELECT demo_balance INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  simulated_win := random() < 0.95;

  IF simulated_win THEN
    effective_exit_price := CASE
      WHEN target_trade.direction = 'up' THEN GREATEST(p_exit_price, target_trade.entry_price * 1.0001)
      ELSE LEAST(p_exit_price, target_trade.entry_price * 0.9999)
    END;
    result_status := 'won';
    result_pnl := ROUND(target_trade.stake * target_trade.payout_rate / 100, 2);
    credit := target_trade.stake + result_pnl;
  ELSE
    effective_exit_price := CASE
      WHEN target_trade.direction = 'up' THEN LEAST(p_exit_price, target_trade.entry_price * 0.9999)
      ELSE GREATEST(p_exit_price, target_trade.entry_price * 1.0001)
    END;
    result_status := 'lost';
    result_pnl := 0 - target_trade.stake;
    credit := 0;
  END IF;

  UPDATE public.profiles
  SET demo_balance = current_balance + credit,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.trades
  SET status = result_status,
      pnl = result_pnl,
      exit_price = effective_exit_price,
      settled_at = now(),
      balance_after_settlement = current_balance + credit
  WHERE id = p_trade_id
  RETURNING * INTO target_trade;

  RETURN NEXT target_trade;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_demo_trade(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_demo_trade(UUID, UUID, NUMERIC) TO service_role;