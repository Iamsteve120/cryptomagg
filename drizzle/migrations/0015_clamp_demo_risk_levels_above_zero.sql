CREATE OR REPLACE FUNCTION public.reserve_demo_trade_with_risk(p_user_id uuid, p_symbol text, p_asset_name text, p_direction text, p_stake numeric, p_payout_rate numeric, p_duration_seconds integer, p_entry_price numeric, p_expires_at timestamp with time zone, p_trade_source text, p_take_profit_percent numeric, p_stop_loss_percent numeric)
 RETURNS SETOF trades
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC(18,2);
  created_trade public.trades;
  calculated_tp NUMERIC;
  calculated_sl NUMERIC;
  calculated_tp_percent NUMERIC;
  calculated_sl_percent NUMERIC;
BEGIN
  IF p_direction NOT IN ('up', 'down') OR p_trade_source NOT IN ('manual', 'assist', 'auto', 'scanner') THEN
    RAISE EXCEPTION 'Invalid trade request';
  END IF;
  IF p_take_profit_percent < 0.1 OR p_take_profit_percent > 2000 OR p_stop_loss_percent < 0.1 OR p_stop_loss_percent > p_stake THEN
    RAISE EXCEPTION 'Invalid dollar risk amounts';
  END IF;

  calculated_tp_percent := p_take_profit_percent / p_stake * 100;
  calculated_sl_percent := p_stop_loss_percent / p_stake * 100;
  -- A price can never fall below zero, so the below-entry side is capped at 95%.
  -- The dollar amounts stay as entered; only the trigger price level is clamped.
  IF p_direction = 'up' THEN
    calculated_sl_percent := LEAST(calculated_sl_percent, 95);
  ELSE
    calculated_tp_percent := LEAST(calculated_tp_percent, 95);
  END IF;
  IF p_direction = 'up' THEN
    calculated_tp := p_entry_price * (1 + calculated_tp_percent / 100);
    calculated_sl := p_entry_price * (1 - calculated_sl_percent / 100);
  ELSE
    calculated_tp := p_entry_price * (1 - calculated_tp_percent / 100);
    calculated_sl := p_entry_price * (1 + calculated_sl_percent / 100);
  END IF;
  IF calculated_tp <= 0 OR calculated_sl <= 0 THEN RAISE EXCEPTION 'Invalid calculated risk levels'; END IF;

  SELECT demo_balance INTO current_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF current_balance IS NULL THEN RAISE EXCEPTION 'Account unavailable'; END IF;
  IF p_stake <= 0 OR p_stake > current_balance THEN RAISE EXCEPTION 'Insufficient demo balance'; END IF;

  UPDATE public.profiles SET demo_balance = current_balance - p_stake, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.trades (
    user_id, symbol, asset_name, direction, stake, payout_rate, duration_seconds, entry_price, expires_at,
    account_mode, balance_before, balance_after_open, trade_source, take_profit_percent, stop_loss_percent,
    take_profit_price, stop_loss_price, take_profit_amount, stop_loss_amount
  ) VALUES (
    p_user_id, p_symbol, p_asset_name, p_direction, p_stake, p_payout_rate, p_duration_seconds, p_entry_price,
    p_expires_at, 'demo', current_balance, current_balance - p_stake, p_trade_source, calculated_tp_percent,
    calculated_sl_percent, calculated_tp, calculated_sl, p_take_profit_percent, p_stop_loss_percent
  ) RETURNING * INTO created_trade;
  RETURN NEXT created_trade;
END;
$function$;