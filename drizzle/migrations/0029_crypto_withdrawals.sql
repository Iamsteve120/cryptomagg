CREATE TABLE public.crypto_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usdt numeric NOT NULL CHECK (amount_usdt > 0),
  asset text NOT NULL CHECK (asset IN ('BTC', 'USDT')),
  network text NOT NULL CHECK (network IN ('btc', 'usdttrc20')),
  destination_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  provider text NOT NULL DEFAULT 'nowpayments',
  provider_payout_id text,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  tx_hash text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crypto_withdrawals TO authenticated;
GRANT ALL ON public.crypto_withdrawals TO service_role;
ALTER TABLE public.crypto_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY crypto_withdrawals_select_own ON public.crypto_withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY crypto_withdrawals_select_admin ON public.crypto_withdrawals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY crypto_withdrawals_no_client_writes ON public.crypto_withdrawals AS RESTRICTIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);
CREATE UNIQUE INDEX crypto_withdrawals_provider_id_key ON public.crypto_withdrawals(provider_payout_id) WHERE provider_payout_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.hold_crypto_withdrawal(p_user_id uuid, p_amount numeric, p_asset text, p_network text, p_address text) RETURNS SETOF public.crypto_withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE current_balance numeric(18,2); created public.crypto_withdrawals; transaction_uuid uuid; BEGIN SELECT live_balance INTO current_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE; IF current_balance IS NULL THEN RAISE EXCEPTION 'Account unavailable'; END IF; IF EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE user_id = p_user_id AND status = 'pending') OR EXISTS (SELECT 1 FROM public.crypto_withdrawals WHERE user_id = p_user_id AND status = 'pending') THEN RAISE EXCEPTION 'Pending withdrawal exists'; END IF; IF p_amount <= 0 OR p_amount > current_balance THEN RAISE EXCEPTION 'Insufficient balance'; END IF; UPDATE public.profiles SET live_balance = current_balance - p_amount, updated_at = now() WHERE id = p_user_id; INSERT INTO public.transactions(user_id, kind, method, asset, amount, status, account_mode, destination) VALUES (p_user_id, 'withdrawal', 'crypto', p_asset, p_amount, 'pending', 'live', p_address) RETURNING id INTO transaction_uuid; INSERT INTO public.crypto_withdrawals(user_id, amount_usdt, asset, network, destination_address, transaction_id) VALUES (p_user_id, p_amount, p_asset, p_network, p_address, transaction_uuid) RETURNING * INTO created; RETURN NEXT created; END; $$;
CREATE OR REPLACE FUNCTION public.finalize_crypto_withdrawal(p_request_id uuid, p_provider_id text, p_success boolean, p_tx_hash text DEFAULT NULL, p_failure_reason text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE target public.crypto_withdrawals; BEGIN SELECT * INTO target FROM public.crypto_withdrawals WHERE (p_request_id IS NOT NULL AND id = p_request_id) OR (p_provider_id IS NOT NULL AND provider_payout_id = p_provider_id) ORDER BY created_at DESC LIMIT 1 FOR UPDATE; IF target.id IS NULL OR target.status <> 'pending' THEN RETURN false; END IF; IF p_success THEN UPDATE public.crypto_withdrawals SET status = 'paid', tx_hash = NULLIF(p_tx_hash,''), updated_at = now() WHERE id = target.id; UPDATE public.transactions SET status = 'completed' WHERE id = target.transaction_id; ELSE UPDATE public.profiles SET live_balance = live_balance + target.amount_usdt, updated_at = now() WHERE id = target.user_id; UPDATE public.crypto_withdrawals SET status = 'rejected', failure_reason = LEFT(COALESCE(NULLIF(p_failure_reason,''),'provider_error'),200), updated_at = now() WHERE id = target.id; UPDATE public.transactions SET status = 'failed' WHERE id = target.transaction_id; END IF; RETURN true; END; $$;
REVOKE EXECUTE ON FUNCTION public.hold_crypto_withdrawal(uuid,numeric,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_crypto_withdrawal(uuid,text,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hold_crypto_withdrawal(uuid,numeric,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_crypto_withdrawal(uuid,text,boolean,text,text) TO service_role;