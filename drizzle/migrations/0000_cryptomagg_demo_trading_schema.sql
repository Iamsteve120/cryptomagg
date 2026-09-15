-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  demo_balance NUMERIC(18,2) NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, email, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- TRANSACTIONS (simulated deposits / withdrawals)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal')),
  method TEXT NOT NULL,
  asset TEXT NOT NULL DEFAULT 'USDT',
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  destination TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX transactions_user_created_idx ON public.transactions (user_id, created_at DESC);

-- TRADES (binary up/down demo trades)
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('up','down')),
  stake NUMERIC(18,2) NOT NULL CHECK (stake > 0),
  payout_rate NUMERIC(5,2) NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  entry_price NUMERIC(24,8) NOT NULL,
  exit_price NUMERIC(24,8),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','tie')),
  pnl NUMERIC(18,2) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades_select_own" ON public.trades
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX trades_user_created_idx ON public.trades (user_id, created_at DESC);
CREATE INDEX trades_open_idx ON public.trades (status, expires_at);
