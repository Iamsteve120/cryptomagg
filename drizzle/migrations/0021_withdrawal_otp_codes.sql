CREATE TABLE public.withdrawal_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  amount_usdt numeric NOT NULL,
  phone text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX withdrawal_otps_user_idx ON public.withdrawal_otps (user_id, created_at DESC);

GRANT ALL ON public.withdrawal_otps TO service_role;

ALTER TABLE public.withdrawal_otps ENABLE ROW LEVEL SECURITY;
