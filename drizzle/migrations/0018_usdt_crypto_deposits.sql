CREATE TABLE public.crypto_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network text NOT NULL DEFAULT 'trc20',
  address text NOT NULL,
  tx_hash text NOT NULL,
  amount_usdt numeric(18,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crypto_deposits_tx_hash_unique UNIQUE (tx_hash)
);

GRANT SELECT ON public.crypto_deposits TO authenticated;
GRANT ALL ON public.crypto_deposits TO service_role;

ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY crypto_deposits_select_own ON public.crypto_deposits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.credit_crypto_deposit(
  p_user_id uuid, p_tx_hash text, p_amount numeric, p_network text, p_address text
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE next_balance NUMERIC(18,2); inserted_id uuid;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  INSERT INTO public.crypto_deposits (user_id, network, address, tx_hash, amount_usdt, status)
  VALUES (p_user_id, p_network, p_address, p_tx_hash, p_amount, 'completed')
  ON CONFLICT (tx_hash) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN RAISE EXCEPTION 'Deposit already credited'; END IF;

  UPDATE public.profiles
  SET live_balance = live_balance + p_amount, updated_at = now()
  WHERE id = p_user_id
  RETURNING live_balance INTO next_balance;

  INSERT INTO public.transactions (user_id, kind, method, asset, amount, status, account_mode, destination)
  VALUES (p_user_id, 'deposit', 'usdt', 'USDT', p_amount, 'completed', 'live', p_address);

  RETURN next_balance;
END; $$;

REVOKE ALL ON FUNCTION public.credit_crypto_deposit(uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_crypto_deposit(uuid, text, numeric, text, text) TO service_role;