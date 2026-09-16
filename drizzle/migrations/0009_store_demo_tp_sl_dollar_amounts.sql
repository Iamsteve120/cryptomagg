ALTER TABLE public.trades
  ADD COLUMN take_profit_amount NUMERIC(18,2),
  ADD COLUMN stop_loss_amount NUMERIC(18,2);

ALTER TABLE public.trades
  ADD CONSTRAINT trades_take_profit_amount_check CHECK (take_profit_amount IS NULL OR take_profit_amount > 0),
  ADD CONSTRAINT trades_stop_loss_amount_check CHECK (stop_loss_amount IS NULL OR stop_loss_amount > 0);

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
$$;
REVOKE ALL ON FUNCTION public.reserve_demo_trade_with_risk(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_demo_trade_with_risk(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.close_demo_trade_at_live_pnl(p_user_id UUID, p_trade_id UUID, p_exit_price NUMERIC)
RETURNS SETOF public.trades LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_trade public.trades; current_balance NUMERIC(18,2); movement NUMERIC; target_distance NUMERIC; live_pnl NUMERIC(18,2); credit NUMERIC(18,2); result_status TEXT;
BEGIN
  IF p_exit_price IS NULL OR p_exit_price <= 0 THEN RAISE EXCEPTION 'Invalid live price'; END IF;
  SELECT * INTO target_trade FROM public.trades WHERE id=p_trade_id AND user_id=p_user_id AND account_mode='demo' FOR UPDATE;
  IF target_trade.id IS NULL THEN RAISE EXCEPTION 'Trade unavailable'; END IF;
  IF target_trade.status <> 'open' THEN RETURN NEXT target_trade; RETURN; END IF;
  SELECT demo_balance INTO current_balance FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  movement := CASE WHEN target_trade.direction='up' THEN p_exit_price-target_trade.entry_price ELSE target_trade.entry_price-p_exit_price END;
  IF movement >= 0 THEN
    target_distance := ABS(target_trade.take_profit_price-target_trade.entry_price);
    live_pnl := CASE WHEN target_distance IS NULL OR target_distance=0 THEN 0 ELSE ROUND(LEAST(1,movement/target_distance)*COALESCE(target_trade.take_profit_amount,target_trade.stake*target_trade.payout_rate/100),2) END;
  ELSE
    target_distance := ABS(target_trade.stop_loss_price-target_trade.entry_price);
    live_pnl := CASE WHEN target_distance IS NULL OR target_distance=0 THEN 0 ELSE ROUND(0-LEAST(1,ABS(movement)/target_distance)*COALESCE(target_trade.stop_loss_amount,target_trade.stake),2) END;
  END IF;
  credit := target_trade.stake+live_pnl;
  result_status := CASE WHEN live_pnl>0 THEN 'won' WHEN live_pnl<0 THEN 'lost' ELSE 'tie' END;
  UPDATE public.profiles SET demo_balance=current_balance+credit,updated_at=now() WHERE id=p_user_id;
  UPDATE public.trades SET status=result_status,pnl=live_pnl,exit_price=p_exit_price,settled_at=now(),balance_after_settlement=current_balance+credit WHERE id=p_trade_id RETURNING * INTO target_trade;
  RETURN NEXT target_trade;
END; $$;
REVOKE ALL ON FUNCTION public.close_demo_trade_at_live_pnl(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_demo_trade_at_live_pnl(UUID, UUID, NUMERIC) TO service_role;