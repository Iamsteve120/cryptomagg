ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS originator_conversation_id text,
  ADD COLUMN IF NOT EXISTS result_code integer,
  ADD COLUMN IF NOT EXISTS receiver_name text;

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_originator_conversation_id_key
  ON public.withdrawal_requests (originator_conversation_id)
  WHERE originator_conversation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.platform_flags (
  flag text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  code text,
  detail text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_flags TO service_role;
ALTER TABLE public.platform_flags ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.b2c_callback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  result_code integer,
  result_desc text,
  conversation_id text,
  originator_conversation_id text,
  transaction_receipt text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.b2c_callback_events TO service_role;
ALTER TABLE public.b2c_callback_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS b2c_callback_events_created_at_idx
  ON public.b2c_callback_events (created_at DESC);

-- Reserves the payout amount and records the originator reference in one
-- transaction. Rejects a second pending payout for the same trader.
CREATE OR REPLACE FUNCTION public.hold_withdrawal_for_payout(
  p_user_id uuid,
  p_amount numeric,
  p_phone text,
  p_originator_conversation_id text
)
RETURNS SETOF public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance numeric(18,2);
  created public.withdrawal_requests;
  created_transaction_id uuid;
  pending_count integer;
BEGIN
  SELECT live_balance INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN RAISE EXCEPTION 'Account unavailable'; END IF;

  SELECT count(*) INTO pending_count
  FROM public.withdrawal_requests
  WHERE user_id = p_user_id AND status = 'pending';
  IF pending_count > 0 THEN RAISE EXCEPTION 'Pending withdrawal exists'; END IF;

  IF p_amount <= 0 OR p_amount > current_balance THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.profiles
  SET live_balance = current_balance - p_amount, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, kind, method, asset, amount, status, account_mode, destination)
  VALUES (p_user_id, 'withdrawal', 'mpesa', 'USDT', p_amount, 'pending', 'live', p_phone)
  RETURNING id INTO created_transaction_id;

  INSERT INTO public.withdrawal_requests (user_id, amount_usdt, phone, transaction_id, originator_conversation_id)
  VALUES (p_user_id, p_amount, p_phone, created_transaction_id, p_originator_conversation_id)
  RETURNING * INTO created;

  RETURN NEXT created;
END;
$function$;

-- Idempotent settlement from the Safaricom result callback. Matches on the
-- originator reference first, then the provider conversation id.
CREATE OR REPLACE FUNCTION public.finalize_b2c_withdrawal(
  p_originator_conversation_id text,
  p_conversation_id text,
  p_success boolean,
  p_receipt text DEFAULT NULL,
  p_result_code integer DEFAULT NULL,
  p_result_desc text DEFAULT NULL,
  p_receiver_name text DEFAULT NULL
)
RETURNS TABLE(request_id uuid, user_id uuid, amount_usdt numeric, phone text, final_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target public.withdrawal_requests;
BEGIN
  SELECT * INTO target
  FROM public.withdrawal_requests
  WHERE (p_originator_conversation_id IS NOT NULL
         AND originator_conversation_id = p_originator_conversation_id)
     OR (p_conversation_id IS NOT NULL
         AND provider_conversation_id = p_conversation_id)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF target.id IS NULL OR target.status <> 'pending' THEN RETURN; END IF;

  IF p_success THEN
    UPDATE public.withdrawal_requests
    SET status = 'paid',
        provider_receipt = NULLIF(p_receipt, ''),
        receiver_name = NULLIF(p_receiver_name, ''),
        result_code = p_result_code,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = target.id;

    IF target.transaction_id IS NOT NULL THEN
      UPDATE public.transactions SET status = 'completed' WHERE id = target.transaction_id;
    END IF;
    final_status := 'completed';
  ELSE
    UPDATE public.profiles
    SET live_balance = live_balance + target.amount_usdt, updated_at = now()
    WHERE id = target.user_id;

    UPDATE public.withdrawal_requests
    SET status = 'rejected',
        failure_reason = LEFT(COALESCE(NULLIF(p_result_desc, ''), 'provider_error'), 200),
        result_code = p_result_code,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = target.id;

    IF target.transaction_id IS NOT NULL THEN
      UPDATE public.transactions SET status = 'failed' WHERE id = target.transaction_id;
    END IF;
    final_status := 'failed';
  END IF;

  request_id := target.id;
  user_id := target.user_id;
  amount_usdt := target.amount_usdt;
  phone := target.phone;
  RETURN NEXT;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.hold_withdrawal_for_payout(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_b2c_withdrawal(text, text, boolean, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hold_withdrawal_for_payout(uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_b2c_withdrawal(text, text, boolean, text, integer, text, text) TO service_role;