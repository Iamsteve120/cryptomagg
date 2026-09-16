ALTER TABLE public.trades DROP CONSTRAINT trades_take_profit_percent_check;
ALTER TABLE public.trades DROP CONSTRAINT trades_stop_loss_percent_check;
ALTER TABLE public.trades
  ADD CONSTRAINT trades_take_profit_percent_check CHECK (take_profit_percent IS NULL OR (take_profit_percent >= 0.1 AND take_profit_percent <= 200000)),
  ADD CONSTRAINT trades_stop_loss_percent_check CHECK (stop_loss_percent IS NULL OR (stop_loss_percent >= 0.1 AND stop_loss_percent <= 100));