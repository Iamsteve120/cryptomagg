-- 1. SECURITY DEFINER functions must not be callable by public/anon.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_client_id() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_client_id() TO service_role;

-- 2. Money-moving tables: reads stay governed by existing RLS policies,
--    writes are only ever performed by trusted server code (service_role).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.trades, public.transactions, public.deposit_intents,
     public.withdrawal_requests, public.crypto_deposits
  FROM anon, authenticated;
GRANT SELECT ON public.trades, public.transactions, public.deposit_intents,
                public.withdrawal_requests, public.crypto_deposits TO authenticated;
GRANT ALL ON public.trades, public.transactions, public.deposit_intents,
              public.withdrawal_requests, public.crypto_deposits TO service_role;

-- 3. Internal-only tables: no client access at all, deny-by-default with RLS
--    enabled and zero policies for anon/authenticated.
REVOKE ALL ON public.platform_flags, public.withdrawal_otps, public.b2c_callback_events
  FROM anon, authenticated;
GRANT ALL ON public.platform_flags, public.withdrawal_otps, public.b2c_callback_events
  TO service_role;

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2c_callback_events ENABLE ROW LEVEL SECURITY;

-- 4. Explicit deny-all policies document intent for the internal tables so no
--    future permissive policy is added by accident.
DROP POLICY IF EXISTS platform_flags_no_client_access ON public.platform_flags;
CREATE POLICY platform_flags_no_client_access ON public.platform_flags
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS withdrawal_otps_no_client_access ON public.withdrawal_otps;
CREATE POLICY withdrawal_otps_no_client_access ON public.withdrawal_otps
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS b2c_callback_events_no_client_access ON public.b2c_callback_events;
CREATE POLICY b2c_callback_events_no_client_access ON public.b2c_callback_events
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 5. Restrictive write guards on the money tables: even if a permissive write
--    policy is ever added, client roles still cannot insert/update/delete.
DROP POLICY IF EXISTS trades_no_client_writes ON public.trades;
CREATE POLICY trades_no_client_writes ON public.trades
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS transactions_no_client_writes ON public.transactions;
CREATE POLICY transactions_no_client_writes ON public.transactions
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS deposit_intents_no_client_writes ON public.deposit_intents;
CREATE POLICY deposit_intents_no_client_writes ON public.deposit_intents
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS withdrawal_requests_no_client_writes ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_no_client_writes ON public.withdrawal_requests
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS crypto_deposits_no_client_writes ON public.crypto_deposits;
CREATE POLICY crypto_deposits_no_client_writes ON public.crypto_deposits
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);
