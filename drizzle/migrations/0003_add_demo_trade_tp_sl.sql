ALTER TABLE public.trades
  ADD COLUMN take_profit_percent NUMERIC(8,4),
  ADD COLUMN stop_loss_percent NUMERIC(8,4),
  ADD COLUMN take_profit_price NUMERIC(24,10),
  ADD COLUMN stop_loss_price NUMERIC(24,10);

ALTER TABLE public.trades
  ADD CONSTRAINT trades_take_profit_percent_check CHECK (take_profit_percent IS NULL OR (take_profit_percent >= 0.1 AND take_profit_percent <= 50)),
  ADD CONSTRAINT trades_stop_loss_percent_check CHECK (stop_loss_percent IS NULL OR (stop_loss_percent >= 0.1 AND stop_loss_percent <= 50)),
  ADD CONSTRAINT trades_take_profit_price_check CHECK (take_profit_price IS NULL OR take_profit_price > 0),
  ADD CONSTRAINT trades_stop_loss_price_check CHECK (stop_loss_price IS NULL OR stop_loss_price > 0);

CREATE OR REPLACE FUNCTION public.reserve_demo_trade_with_risk(
  p_user_id UUID,
  p_symbol TEXT,
  p_asset_name TEXT,
  p_direction TEXT,
  p_stake NUMERIC,
  p_payout_rate NUMERIC,
  p_duration_seconds INTEGER,
  p_entry_price NUMERIC,
  p_expires_at TIMESTAMPTZ,
  p_trade_source TEXT,
  p_take_profit_percent NUMERIC,
  p_stop_loss_percent NUMERIC
)
RETURNS SETOF public.trades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC(18,2);
  created_trade public.trades;
  calculated_take_profit NUMERIC(24,10);
  calculated_stop_loss NUMERIC(24,10);
BEGIN
  IF p_direction NOT IN ('up', 'down') OR p_trade_source NOT IN ('manual', 'assist', 'auto') THEN
    RAISE EXCEPTION 'Invalid trade request';
  END IF;

  IF p_take_profit_percent < 0.1 OR p_take_profit_percent > 50
     OR p_stop_loss_percent < 0.1 OR p_stop_loss_percent > 50 THEN
    RAISE EXCEPTION 'Invalid trade levels';
  END IF;

  IF p_direction = 'up' THEN
    calculated_take_profit := p_entry_price * (1 + p_take_profit_percent / 100);
    calculated_stop_loss := p_entry_price * (1 - p_stop_loss_percent / 100);
  ELSE
    calculated_take_profit := p_entry_price * (1 - p_take_profit_percent / 100);
    calculated_stop_loss := p_entry_price * (1 + p_stop_loss_percent / 100);
  END IF;

  IF calculated_take_profit <= 0 OR calculated_stop_loss <= 0 THEN
    RAISE EXCEPTION 'Invalid trade levels';
  END IF;

  SELECT demo_balance INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Account unavailable';
  END IF;

  IF p_stake <= 0 OR p_stake > current_balance THEN
    RAISE EXCEPTION 'Insufficient demo balance';
  END IF;

  UPDATE public.profiles
  SET demo_balance = current_balance - p_stake,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.trades (
    user_id, symbol, asset_name, direction, stake, payout_rate,
    duration_seconds, entry_price, expires_at, account_mode,
    balance_before, balance_after_open, trade_source,
    take_profit_percent, stop_loss_percent, take_profit_price, stop_loss_price
  ) VALUES (
    p_user_id, p_symbol, p_asset_name, p_direction, p_stake, p_payout_rate,
    p_duration_seconds, p_entry_price, p_expires_at, 'demo',
    current_balance, current_balance - p_stake, p_trade_source,
    p_take_profit_percent, p_stop_loss_percent, calculated_take_profit, calculated_stop_loss
  )
  RETURNING * INTO created_trade;

  RETURN NEXT created_trade;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_demo_trade_with_risk(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_demo_trade_with_risk(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC) TO service_role;