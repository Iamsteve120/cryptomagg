/**
 * Real account rules. These numbers are published to traders in the app and
 * must never be changed per trader, per trade, or after a trade opens.
 */

/** A winning real trade pays this percentage of the stake. A loss costs the full stake. */
export const LIVE_PAYOUT_RATE = 15;

/** House edge on an evenly balanced market, shown to traders for honesty. */
export const LIVE_HOUSE_EDGE_PERCENT = Math.round((100 - LIVE_PAYOUT_RATE) / 2);

export const LIVE_MIN_STAKE = 0.5;
export const LIVE_MAX_STAKE = 200;

/** Minimum and maximum M Pesa deposit, in USDT. */
export const LIVE_MIN_DEPOSIT = 5;
export const LIVE_MAX_DEPOSIT = 500;

/** Minimum M Pesa withdrawal, in USDT. */
export const LIVE_MIN_WITHDRAWAL = 5;

/** Smallest USDT crypto transfer we credit. */
export const USDT_MIN_DEPOSIT = 50;

/** Smallest BTC crypto transfer we credit, in USD equivalent. */
export const BTC_MIN_DEPOSIT_USD = 50;

/** Smallest crypto withdrawal, in USDT equivalent, on every network. */
export const CRYPTO_MIN_WITHDRAWAL = 50;

/** Receiving addresses for USDT crypto deposits. */
export const USDT_DEPOSIT_ADDRESSES: readonly { label: string; network: string; address: string }[] = [
  {
    label: "USDT wallet 1",
    network: "Tron (TRC 20)",
    address: "TBWg9bx8uDr6Y9bQVqDXUZEbsrESWCyv2z",
  },
];

/** Receiving addresses for Bitcoin deposits. */
export const BTC_DEPOSIT_ADDRESSES: readonly { label: string; network: string; address: string }[] = [
  {
    label: "Bitcoin wallet",
    network: "Bitcoin",
    address: "bc1q4zv3u25cmhw5nga995jveya0aalxxvqeqsvuqa",
  },
];

/** Broker risk caps on real accounts. */
export const LIVE_MAX_OPEN_TRADES_PER_TRADER = 50;
export const LIVE_MAX_TOTAL_EXPOSURE = 2000;

/** Normalises a Kenyan number to the 2547XXXXXXXX form M Pesa expects. */
export function normaliseKenyanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^254(7|1)\d{8}$/.test(digits)) return digits;
  if (/^0(7|1)\d{8}$/.test(digits)) return "254" + digits.slice(1);
  if (/^(7|1)\d{8}$/.test(digits)) return "254" + digits;
  return null;
}
