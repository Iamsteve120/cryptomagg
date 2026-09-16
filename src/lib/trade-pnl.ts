/** Kept in sync with close_demo_trade_at_live_pnl in the database. */
export const LIVE_PNL_SENSITIVITY = 100;

export function calculateLivePnl(trade: {
  direction: string;
  entry_price: number;
  stake: number;
  payout_rate: number;
  take_profit_price: number | null;
  stop_loss_price: number | null;
  take_profit_amount?: number | null;
  stop_loss_amount?: number | null;
}, currentPrice: number | undefined) {
  const entry = Number(trade.entry_price);
  const price = currentPrice ?? entry;
  const movement = trade.direction === "up" ? price - entry : entry - price;
  const favorable = movement >= 0;
  const targetPrice = favorable ? trade.take_profit_price : trade.stop_loss_price;
  const targetDistance = targetPrice === null ? 0 : Math.abs(Number(targetPrice) - entry);
  if (targetDistance === 0) return 0;
  // Practice sensitivity: small real price moves translate into a visibly moving simulated result.
  const ratio = Math.min(1, (Math.abs(movement) / targetDistance) * LIVE_PNL_SENSITIVITY);
  const profitTarget = trade.take_profit_amount != null ? Number(trade.take_profit_amount) : (Number(trade.stake) * Number(trade.payout_rate)) / 100;
  const lossTarget = trade.stop_loss_amount != null ? Number(trade.stop_loss_amount) : Number(trade.stake);
  return favorable ? profitTarget * ratio : 0 - lossTarget * ratio;
}
