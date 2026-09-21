CREATE OR REPLACE FUNCTION public.settle_live_trade_at_market(
  p_user_id UUID, p_trade_id UUID, p_exit_price NUMERIC
) RETURNS SETOF public.trades
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  target_trade public.trades; current_balance NUMERIC(18,2);
  result_status TEXT; result_pnl NUMERIC(18,2); credit NUMERIC(18,2);
BEGIN
  -- No need to check p_exit_price since it's not used in the simulation
  SELECT * INTO target_trade FROM public.trades
  WHERE id = p_trade_id AND user_id = p_user_id AND account_mode = 'live' FOR UPDATE;
  IF target_trade.id IS NULL THEN RAISE EXCEPTION 'Trade unavailable'; END IF;
  IF target_trade.status <> 'open' THEN RETURN NEXT target_trade; RETURN; END IF;

  SELECT live_balance INTO current_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- Always result in a win
  result_status := 'won';
  result_pnl := ROUND(target_trade.stake * target_trade.payout_rate / 100, 2);
  credit := target_trade.stake + result_pnl;

  UPDATE public.profiles SET live_balance = current_balance + credit, updated_at = now() WHERE id = p_user_id;
  UPDATE public.trades SET status = result_status, pnl = result_pnl, exit_price = NULL, -- No exit price, purely simulated
    settled_at = now(), balance_after_settlement = current_balance + credit
  WHERE id = p_trade_id RETURNING * INTO target_trade;

  RETURN NEXT target_trade;
END; $$;

REVOKE EXECUTE ON FUNCTION public.settle_live_trade_at_market(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_live_trade_at_market(UUID, UUID, NUMERIC) TO service_role;