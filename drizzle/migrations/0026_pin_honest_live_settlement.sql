CREATE OR REPLACE FUNCTION public.settle_live_trade_at_market(
  p_user_id UUID, p_trade_id UUID, p_exit_price NUMERIC
) RETURNS SETOF public.trades
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  target_trade public.trades; current_balance NUMERIC(18,2);
  movement NUMERIC; result_status TEXT; result_pnl NUMERIC(18,2); credit NUMERIC(18,2);
BEGIN
  IF p_exit_price IS NULL OR p_exit_price <= 0 THEN RAISE EXCEPTION 'Invalid market price'; END IF;

  SELECT * INTO target_trade FROM public.trades
  WHERE id = p_trade_id AND user_id = p_user_id AND account_mode = 'live' FOR UPDATE;
  IF target_trade.id IS NULL THEN RAISE EXCEPTION 'Trade unavailable'; END IF;
  IF target_trade.status <> 'open' THEN RETURN NEXT target_trade; RETURN; END IF;

  SELECT live_balance INTO current_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- Outcome is determined solely by the live market price vs the entry price.
  -- No account-specific overrides exist or are allowed.
  movement := CASE WHEN target_trade.direction = 'up'
    THEN p_exit_price - target_trade.entry_price
    ELSE target_trade.entry_price - p_exit_price END;

  IF movement > 0 THEN
    result_status := 'won';
    result_pnl := ROUND(target_trade.stake * target_trade.payout_rate / 100, 2);
    credit := target_trade.stake + result_pnl;
  ELSIF movement = 0 THEN
    -- Price closed exactly at entry: the stake is returned, nobody profits.
    result_status := 'tie';
    result_pnl := 0;
    credit := target_trade.stake;
  ELSE
    result_status := 'lost';
    result_pnl := 0 - target_trade.stake;
    credit := 0;
  END IF;

  UPDATE public.profiles SET live_balance = current_balance + credit, updated_at = now() WHERE id = p_user_id;
  UPDATE public.trades SET status = result_status, pnl = result_pnl, exit_price = p_exit_price,
    settled_at = now(), balance_after_settlement = current_balance + credit
  WHERE id = p_trade_id RETURNING * INTO target_trade;

  RETURN NEXT target_trade;
END; $$;

REVOKE EXECUTE ON FUNCTION public.settle_live_trade_at_market(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_live_trade_at_market(UUID, UUID, NUMERIC) TO service_role;