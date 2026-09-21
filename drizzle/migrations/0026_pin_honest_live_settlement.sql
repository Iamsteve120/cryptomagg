CREATE OR REPLACE FUNCTION public.settle_live_trade_at_market (
  p_user_id UUID,
  p_trade_id UUID,
  p_exit_price NUMERIC
) RETURNS SETOF public.trades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  target_trade      public.trades;
  current_balance   NUMERIC(18,2);
  result_status     TEXT;
  result_pnl        NUMERIC(18,2);
  credit            NUMERIC(18,2);
  is_demo_winner    BOOLEAN;
  is_win            BOOLEAN;
BEGIN
  IF p_exit_price IS NULL OR p_exit_price <= 0 THEN
    RAISE EXCEPTION 'Invalid exit price';
  END IF;

  -- Lock the trade, verify ownership + live mode
  SELECT * INTO target_trade
    FROM public.trades
   WHERE id = p_trade_id
     AND user_id = p_user_id
     AND account_mode = 'live'
   FOR UPDATE;

  IF target_trade.id IS NULL THEN
    RAISE EXCEPTION 'Trade unavailable';
  END IF;

  -- Idempotent: already settled, return as-is
  IF target_trade.status <> 'open' THEN
    RETURN NEXT target_trade;
    RETURN;
  END IF;

  SELECT live_balance, is_demo_winner
    INTO current_balance, is_demo_winner
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Account unavailable';
  END IF;

  -- Decide the outcome
  IF is_demo_winner THEN
    -- Experiment account: always win
    is_win := true;
  ELSE
    -- Honest settlement against real market price + direction
    IF target_trade.direction = 'up' THEN
      is_win := p_exit_price > target_trade.entry_price;
    ELSIF target_trade.direction = 'down' THEN
      is_win := p_exit_price < target_trade.entry_price;
    ELSE
      RAISE EXCEPTION 'Unknown trade direction: %', target_trade.direction;
    END IF;
  END IF;

  IF is_win THEN
    result_status := 'won';
    result_pnl    := ROUND(target_trade.stake * target_trade.payout_rate / 100, 2);
    credit        := target_trade.stake + result_pnl;
  ELSE
    result_status := 'lost';
    result_pnl    := -target_trade.stake;
    credit        := 0;   -- stake was already debited at open
  END IF;

  -- Credit winnings (if any) to live balance
  IF credit > 0 THEN
    UPDATE public.profiles
       SET live_balance = current_balance + credit,
           updated_at   = now()
     WHERE id = p_user_id;
  END IF;

  -- Settle the trade, always recording the real exit price
  UPDATE public.trades
     SET status                   = result_status,
         pnl                      = result_pnl,
         exit_price               = p_exit_price,
         settled_at               = now(),
         balance_after_settlement = current_balance + credit
   WHERE id = p_trade_id
   RETURNING * INTO target_trade;

  RETURN NEXT target_trade;
END;
$$;

-- Lock it down: only the service role should call this.
REVOKE ALL ON FUNCTION public.settle_live_trade_at_market(UUID, UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_live_trade_at_market(UUID, UUID, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_live_trade_at_market(UUID, UUID, NUMERIC) TO service_role;