-- 1. Roles ------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Client IDs and extended profile details --------------------------------
CREATE SEQUENCE IF NOT EXISTS public.client_id_seq START WITH 68202 INCREMENT BY 1;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_doc_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_doc_path text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'not_submitted';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.next_client_id()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'IDCW' || lpad(nextval('public.client_id_seq')::text, 6, '0');
$$;

REVOKE ALL ON FUNCTION public.next_client_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_client_id() TO service_role;

UPDATE public.profiles SET client_id = public.next_client_id() WHERE client_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_client_id_key ON public.profiles (client_id);

-- 3. Activity log -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'signin',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_events_created_at_idx ON public.login_events (created_at DESC);
CREATE INDEX IF NOT EXISTS login_events_user_idx ON public.login_events (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS login_events_insert_own ON public.login_events;
CREATE POLICY login_events_insert_own ON public.login_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS login_events_select_own ON public.login_events;
CREATE POLICY login_events_select_own ON public.login_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. Admin read access (server-checked role) --------------------------------
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS transactions_select_admin ON public.transactions;
CREATE POLICY transactions_select_admin ON public.transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS trades_select_admin ON public.trades;
CREATE POLICY trades_select_admin ON public.trades
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS withdrawal_requests_select_admin ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_select_admin ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS deposit_intents_select_admin ON public.deposit_intents;
CREATE POLICY deposit_intents_select_admin ON public.deposit_intents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
