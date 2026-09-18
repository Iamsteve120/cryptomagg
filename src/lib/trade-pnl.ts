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

type LiveTrade = Parameters<typeof calculateLivePnl>[0] & {
  id?: string;
};

function phaseForTrade(id: string | undefined) {
  if (!id) return 0;
  return [...id].reduce((value, character) => value + character.charCodeAt(0), 0) % 360;
}

/**
 * Adds a very small visual micro tick between exchange polls. The movement stays
 * anchored to the latest market price and never changes server settlement.
 */
export function calculateRapidLiveState(trade: LiveTrade, currentPrice: number | undefined, now: number) {
  const entry = Number(trade.entry_price);
  const marketPrice = currentPrice ?? entry;
  const tpDistance = trade.take_profit_price === null ? 0 : Math.abs(Number(trade.take_profit_price) - entry);
  const slDistance = trade.stop_loss_price === null ? 0 : Math.abs(Number(trade.stop_loss_price) - entry);
  const referenceDistance = Math.max(tpDistance, slDistance);
  if (!Number.isFinite(referenceDistance) || referenceDistance <= 0) {
    return { price: marketPrice, pnl: calculateLivePnl(trade, marketPrice) };
  }

  const phase = phaseForTrade(trade.id) * (Math.PI / 180);
  const wave = Math.sin(now / 430 + phase) * 0.72 + Math.sin(now / 173 + phase * 0.6) * 0.28;
  const microMove = (referenceDistance / LIVE_PNL_SENSITIVITY) * 0.45 * wave;
  const price = Math.max(Number.EPSILON, marketPrice + microMove);
  return { price, pnl: calculateLivePnl(trade, price) };
}
