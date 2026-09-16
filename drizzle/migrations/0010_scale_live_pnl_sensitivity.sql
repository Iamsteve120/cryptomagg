CREATE OR REPLACE FUNCTION public.close_demo_trade_at_live_pnl(p_user_id UUID, p_trade_id UUID, p_exit_price NUMERIC)
RETURNS SETOF public.trades LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_trade public.trades; current_balance NUMERIC(18,2); movement NUMERIC; target_distance NUMERIC; live_pnl NUMERIC(18,2); credit NUMERIC(18,2); result_status TEXT; sensitivity NUMERIC := 100;
BEGIN
  IF p_exit_price IS NULL OR p_exit_price <= 0 THEN RAISE EXCEPTION 'Invalid live price'; END IF;
  SELECT * INTO target_trade FROM public.trades WHERE id=p_trade_id AND user_id=p_user_id AND account_mode='demo' FOR UPDATE;
  IF target_trade.id IS NULL THEN RAISE EXCEPTION 'Trade unavailable'; END IF;
  IF target_trade.status <> 'open' THEN RETURN NEXT target_trade; RETURN; END IF;
  SELECT demo_balance INTO current_balance FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  movement := CASE WHEN target_trade.direction='up' THEN p_exit_price-target_trade.entry_price ELSE target_trade.entry_price-p_exit_price END;
  IF movement >= 0 THEN
    target_distance := ABS(target_trade.take_profit_price-target_trade.entry_price);
    live_pnl := CASE WHEN target_distance IS NULL OR target_distance=0 THEN 0 ELSE ROUND(LEAST(1,movement/target_distance*sensitivity)*COALESCE(target_trade.take_profit_amount,target_trade.stake*target_trade.payout_rate/100),2) END;
  ELSE
    target_distance := ABS(target_trade.stop_loss_price-target_trade.entry_price);
    live_pnl := CASE WHEN target_distance IS NULL OR target_distance=0 THEN 0 ELSE ROUND(0-LEAST(1,ABS(movement)/target_distance*sensitivity)*COALESCE(target_trade.stop_loss_amount,target_trade.stake),2) END;
  END IF;
  credit := target_trade.stake+live_pnl;
  result_status := CASE WHEN live_pnl>0 THEN 'won' WHEN live_pnl<0 THEN 'lost' ELSE 'tie' END;
  UPDATE public.profiles SET demo_balance=current_balance+credit,updated_at=now() WHERE id=p_user_id;
  UPDATE public.trades SET status=result_status,pnl=live_pnl,exit_price=p_exit_price,settled_at=now(),balance_after_settlement=current_balance+credit WHERE id=p_trade_id RETURNING * INTO target_trade;
  RETURN NEXT target_trade;
END; $$;
REVOKE ALL ON FUNCTION public.close_demo_trade_at_live_pnl(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_demo_trade_at_live_pnl(UUID, UUID, NUMERIC) TO service_role;