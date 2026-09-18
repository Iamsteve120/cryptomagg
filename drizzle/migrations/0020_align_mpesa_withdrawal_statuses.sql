CREATE OR REPLACE FUNCTION public.finalize_mpesa_withdrawal(
  p_conversation_id text,
  p_success boolean,
  p_receipt text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL
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
  WHERE provider_conversation_id = p_conversation_id
  FOR UPDATE;

  IF target.id IS NULL OR target.status <> 'pending' THEN RETURN; END IF;

  IF p_success THEN
    UPDATE public.withdrawal_requests
    SET status = 'paid', provider_receipt = NULLIF(p_receipt, ''), reviewed_at = now(), updated_at = now()
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
    SET status = 'rejected', failure_reason = LEFT(COALESCE(NULLIF(p_failure_reason, ''), 'provider_error'), 200), reviewed_at = now(), updated_at = now()
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

CREATE OR REPLACE FUNCTION public.refund_pending_withdrawal(
  p_request_id uuid,
  p_failure_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target public.withdrawal_requests;
BEGIN
  SELECT * INTO target
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF target.id IS NULL OR target.status <> 'pending' THEN RETURN false; END IF;

  UPDATE public.profiles
  SET live_balance = live_balance + target.amount_usdt, updated_at = now()
  WHERE id = target.user_id;

  UPDATE public.withdrawal_requests
  SET status = 'rejected', failure_reason = LEFT(COALESCE(NULLIF(p_failure_reason, ''), 'payout_not_started'), 200), reviewed_at = now(), updated_at = now()
  WHERE id = target.id;

  IF target.transaction_id IS NOT NULL THEN
    UPDATE public.transactions SET status = 'failed' WHERE id = target.transaction_id;
  ELSE
    UPDATE public.transactions
    SET status = 'failed'
    WHERE id = (
      SELECT id FROM public.transactions
      WHERE user_id = target.user_id
        AND kind = 'withdrawal'
        AND status = 'pending'
        AND amount = target.amount_usdt
        AND destination = target.phone
      ORDER BY created_at DESC
      LIMIT 1
    );
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalize_mpesa_withdrawal(text, boolean, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_pending_withdrawal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mpesa_withdrawal(text, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_pending_withdrawal(uuid, text) TO service_role;