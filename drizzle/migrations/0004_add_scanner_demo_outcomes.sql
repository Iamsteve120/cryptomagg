ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_trade_source_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_trade_source_check
  CHECK (trade_source IN ('manual', 'assist', 'auto', 'scanner'));

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
  calculated_tp NUMERIC;
  calculated_sl NUMERIC;
BEGIN
  IF p_direction NOT IN ('up', 'down') OR p_trade_source NOT IN ('manual', 'assist', 'auto', 'scanner') THEN
    RAISE EXCEPTION 'Invalid trade request';
  END IF;

  IF p_take_profit_percent < 0.1 OR p_take_profit_percent > 50
     OR p_stop_loss_percent < 0.1 OR p_stop_loss_percent > 50 THEN
    RAISE EXCEPTION 'Invalid risk levels';
  END IF;

  IF p_direction = 'up' THEN
    calculated_tp := p_entry_price * (1 + p_take_profit_percent / 100);
    calculated_sl := p_entry_price * (1 - p_stop_loss_percent / 100);
  ELSE
    calculated_tp := p_entry_price * (1 - p_take_profit_percent / 100);
    calculated_sl := p_entry_price * (1 + p_stop_loss_percent / 100);
  END IF;

  IF calculated_tp <= 0 OR calculated_sl <= 0 THEN
    RAISE EXCEPTION 'Invalid calculated risk levels';
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
    p_take_profit_percent, p_stop_loss_percent, calculated_tp, calculated_sl
  )
  RETURNING * INTO created_trade;

  RETURN NEXT created_trade;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_demo_trade_with_risk(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_demo_trade_with_risk(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_demo_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_exit_price NUMERIC
)
RETURNS SETOF public.trades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_trade public.trades;
  current_balance NUMERIC(18,2);
  credit NUMERIC(18,2) := 0;
  result_status TEXT;
  result_pnl NUMERIC(18,2) := 0;
  effective_exit_price NUMERIC;
BEGIN
  SELECT * INTO target_trade
  FROM public.trades
  WHERE id = p_trade_id
    AND user_id = p_user_id
    AND account_mode = 'demo'
  FOR UPDATE;

  IF target_trade.id IS NULL THEN
    RAISE EXCEPTION 'Trade unavailable';
  END IF;

  IF target_trade.status <> 'open' THEN
    RETURN NEXT target_trade;
    RETURN;
  END IF;

  SELECT demo_balance INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  effective_exit_price := p_exit_price;

  IF target_trade.trade_source = 'scanner' THEN
    IF target_trade.direction = 'up' THEN
      effective_exit_price := GREATEST(p_exit_price, target_trade.entry_price * 1.0001);
    ELSE
      effective_exit_price := LEAST(p_exit_price, target_trade.entry_price * 0.9999);
    END IF;
  END IF;

  IF effective_exit_price = target_trade.entry_price THEN
    result_status := 'tie';
    credit := target_trade.stake;
  ELSIF (target_trade.direction = 'up' AND effective_exit_price > target_trade.entry_price)
     OR (target_trade.direction = 'down' AND effective_exit_price < target_trade.entry_price) THEN
    result_status := 'won';
    result_pnl := ROUND(target_trade.stake * target_trade.payout_rate / 100, 2);
    credit := target_trade.stake + result_pnl;
  ELSE
    result_status := 'lost';
    result_pnl := 0 - target_trade.stake;
  END IF;

  UPDATE public.profiles
  SET demo_balance = current_balance + credit,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.trades
  SET status = result_status,
      pnl = result_pnl,
      exit_price = effective_exit_price,
      settled_at = now(),
      balance_after_settlement = current_balance + credit
  WHERE id = p_trade_id
  RETURNING * INTO target_trade;

  RETURN NEXT target_trade;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_demo_trade(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_demo_trade(UUID, UUID, NUMERIC) TO service_role;