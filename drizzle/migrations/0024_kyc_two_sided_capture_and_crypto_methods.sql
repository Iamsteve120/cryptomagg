ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_doc_front_path text,
  ADD COLUMN IF NOT EXISTS kyc_doc_back_path text,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS kyc_approved_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.credit_crypto_deposit(
  p_user_id uuid,
  p_tx_hash text,
  p_amount numeric,
  p_network text,
  p_address text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_balance NUMERIC(18,2); inserted_id uuid;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_network NOT IN ('trc20', 'bitcoin') THEN RAISE EXCEPTION 'Invalid network'; END IF;

  INSERT INTO public.crypto_deposits (user_id, network, address, tx_hash, amount_usdt, status)
  VALUES (p_user_id, p_network, p_address, lower(p_tx_hash), p_amount, 'completed')
  ON CONFLICT (tx_hash) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN RAISE EXCEPTION 'Deposit already credited'; END IF;

  UPDATE public.profiles
  SET live_balance = live_balance + p_amount, updated_at = now()
  WHERE id = p_user_id
  RETURNING live_balance INTO next_balance;

  INSERT INTO public.transactions (user_id, kind, method, asset, amount, status, account_mode, destination)
  VALUES (
    p_user_id,
    'deposit',
    CASE WHEN p_network = 'bitcoin' THEN 'btc' ELSE 'usdt' END,
    CASE WHEN p_network = 'bitcoin' THEN 'BTC' ELSE 'USDT' END,
    p_amount,
    'completed',
    'live',
    p_address
  );

  RETURN next_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_crypto_deposit(uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_crypto_deposit(uuid, text, numeric, text, text) TO service_role;