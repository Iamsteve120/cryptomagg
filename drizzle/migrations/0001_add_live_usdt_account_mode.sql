ALTER TABLE public.profiles
ADD COLUMN live_balance NUMERIC(18,2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_live_balance_nonnegative CHECK (live_balance >= 0);

ALTER TABLE public.trades
ADD COLUMN account_mode TEXT NOT NULL DEFAULT 'demo';

ALTER TABLE public.trades
ADD CONSTRAINT trades_account_mode_valid CHECK (account_mode IN ('demo', 'live'));

ALTER TABLE public.transactions
ADD COLUMN account_mode TEXT NOT NULL DEFAULT 'demo';

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_account_mode_valid CHECK (account_mode IN ('demo', 'live'));

CREATE INDEX trades_user_account_mode_idx ON public.trades (user_id, account_mode, created_at DESC);
CREATE INDEX transactions_user_account_mode_idx ON public.transactions (user_id, account_mode, created_at DESC);