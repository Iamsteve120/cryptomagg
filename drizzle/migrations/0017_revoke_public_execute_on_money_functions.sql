REVOKE EXECUTE ON FUNCTION public.reserve_live_trade(uuid, text, text, text, numeric, numeric, integer, numeric, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_live_trade_at_market(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_confirmed_deposit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hold_withdrawal_amount(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_live_trade(uuid, text, text, text, numeric, numeric, integer, numeric, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_live_trade_at_market(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_confirmed_deposit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hold_withdrawal_amount(uuid, numeric, text) TO service_role;