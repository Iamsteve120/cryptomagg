CREATE OR REPLACE FUNCTION public.close_demo_trade_at_live_pnl(p_user_id uuid, p_trade_id uuid, p_exit_price numeric)
 RETURNS SETOF trades
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE target_trade public.trades; current_balance NUMERIC(18,2); movement NUMERIC; target_distance NUMERIC; live_pnl NUMERIC(18,2); credit NUMERIC(18,2); result_status TEXT; sensitivity NUMERIC := 100; tp_amount NUMERIC(18,2); sl_amount NUMERIC(18,2); base_result NUMERIC(18,2);
BEGIN
  IF p_exit_price IS NULL OR p_exit_price <= 0 THEN RAISE EXCEPTION 'Invalid live price'; END IF;
  SELECT * INTO target_trade FROM public.trades WHERE id=p_trade_id AND user_id=p_user_id AND account_mode='demo' FOR UPDATE;
  IF target_trade.id IS NULL THEN RAISE EXCEPTION 'Trade unavailable'; END IF;
  IF target_trade.status <> 'open' THEN RETURN NEXT target_trade; RETURN; END IF;
  SELECT demo_balance INTO current_balance FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  tp_amount := ROUND(COALESCE(target_trade.take_profit_amount, target_trade.stake*target_trade.payout_rate/100), 2);
  sl_amount := ROUND(COALESCE(target_trade.stop_loss_amount, target_trade.stake), 2);
  -- Simulated result always scales with the trade amount: 1 USD stake -> 0.46 USD.
  base_result := GREATEST(0.46, ROUND(target_trade.stake*0.46, 2));
  movement := CASE WHEN target_trade.direction='up' THEN p_exit_price-target_trade.entry_price ELSE target_trade.entry_price-p_exit_price END;
  IF movement >= 0 THEN
    target_distance := ABS(target_trade.take_profit_price-target_trade.entry_price);
    live_pnl := CASE WHEN target_distance IS NULL OR target_distance=0 THEN 0 ELSE ROUND(LEAST(1,movement/target_distance*sensitivity)*tp_amount,2) END;
  ELSE
    target_distance := ABS(target_trade.stop_loss_price-target_trade.entry_price);
    live_pnl := CASE WHEN target_distance IS NULL OR target_distance=0 THEN 0 ELSE ROUND(0-LEAST(1,ABS(movement)/target_distance*sensitivity)*sl_amount,2) END;
  END IF;
  IF live_pnl >= 0 THEN
    live_pnl := GREATEST(live_pnl, base_result);
  ELSE
    live_pnl := 0 - GREATEST(ABS(live_pnl), LEAST(sl_amount, base_result));
  END IF;
  credit := target_trade.stake+live_pnl;
  result_status := CASE WHEN live_pnl>0 THEN 'won' ELSE 'lost' END;
  UPDATE public.profiles SET demo_balance=GREATEST(0, current_balance+credit),updated_at=now() WHERE id=p_user_id;
  UPDATE public.trades SET status=result_status,pnl=live_pnl,exit_price=p_exit_price,settled_at=now(),balance_after_settlement=GREATEST(0, current_balance+credit) WHERE id=p_trade_id RETURNING * INTO target_trade;
  RETURN NEXT target_trade;
END; $function$;