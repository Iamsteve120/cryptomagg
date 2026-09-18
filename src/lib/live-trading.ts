/**
 * Real account rules. These numbers are published to traders in the app and
 * must never be changed per trader, per trade, or after a trade opens.
 */

/** A winning real trade pays this percentage of the stake. A loss costs the full stake. */
export const LIVE_PAYOUT_RATE = 70;

/** House edge on an evenly balanced market, shown to traders for honesty. */
export const LIVE_HOUSE_EDGE_PERCENT = Math.round((100 - LIVE_PAYOUT_RATE) / 2);

export const LIVE_MIN_STAKE = 1;
export const LIVE_MAX_STAKE = 200;

/** Minimum and maximum M Pesa deposit, in USDT. */
// Testing minimums: about 50 KES at current rates. Raise back to 5 before opening to the public.
export const LIVE_MIN_DEPOSIT = 0.39;
export const LIVE_MAX_DEPOSIT = 500;

/** Minimum withdrawal, in USDT. */
export const LIVE_MIN_WITHDRAWAL = 0.39;

/** Smallest USDT crypto transfer we credit. */
export const USDT_MIN_DEPOSIT = 10;

/** Receiving addresses for USDT crypto deposits. */
export const USDT_DEPOSIT_ADDRESSES: readonly { label: string; network: string; address: string }[] = [
  {
    label: "USDT wallet 1",
    network: "Tron (TRC 20)",
    address: "TBWg9bx8uDr6Y9bQVqDXUZEbsrESWCyv2z",
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
