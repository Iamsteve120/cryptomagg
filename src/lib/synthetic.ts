/**
 * Synthetic crypto instruments.
 *
 * These are computer generated price series, not real coins. The series is a
 * pure function of the instrument and the clock, so:
 *   - every trader on the planet sees the exact same price at the same moment
 *   - the server cannot nudge a price for a single trader or a single trade
 *   - anyone can recompute any past price and check a settlement
 *
 * The house makes its money from the published payout rate only. There is no
 * outcome control anywhere in this file, and there must never be one.
 */

export type SyntheticInstrument = {
  symbol: string;
  name: string;
  /** Starting level of the series. */
  base: number;
  /** Yearly style volatility factor. Higher means bigger swings. */
  volatility: number;
  /** Occasional upward or downward spikes, in the style of boom and crash indices. */
  spike: "none" | "up" | "down";
  brandColor: string;
  payoutRate: number;
};

/** Published payout on every synthetic instrument. Never varies by trader. */
export const SYNTHETIC_PAYOUT_RATE = 70;

export const SYNTHETIC_INSTRUMENTS: SyntheticInstrument[] = [
  { symbol: "CVOL10", name: "Crypto Volatility 10 (Synthetic)", base: 1000, volatility: 0.006, spike: "none", brandColor: "#22c55e", payoutRate: SYNTHETIC_PAYOUT_RATE },
  { symbol: "CVOL25", name: "Crypto Volatility 25 (Synthetic)", base: 2500, volatility: 0.014, spike: "none", brandColor: "#16a34a", payoutRate: SYNTHETIC_PAYOUT_RATE },
  { symbol: "CVOL50", name: "Crypto Volatility 50 (Synthetic)", base: 5000, volatility: 0.028, spike: "none", brandColor: "#0ea5e9", payoutRate: SYNTHETIC_PAYOUT_RATE },
  { symbol: "CVOL75", name: "Crypto Volatility 75 (Synthetic)", base: 7500, volatility: 0.042, spike: "none", brandColor: "#f59e0b", payoutRate: SYNTHETIC_PAYOUT_RATE },
  { symbol: "CVOL100", name: "Crypto Volatility 100 (Synthetic)", base: 10000, volatility: 0.058, spike: "none", brandColor: "#ef4444", payoutRate: SYNTHETIC_PAYOUT_RATE },
  { symbol: "CVOL250", name: "Crypto Volatility 250 (Synthetic)", base: 25000, volatility: 0.11, spike: "none", brandColor: "#a855f7", payoutRate: SYNTHETIC_PAYOUT_RATE },
  { symbol: "CBOOM300", name: "Crypto Boom 300 (Synthetic)", base: 3000, volatility: 0.02, spike: "up", brandColor: "#10b981", payoutRate: SYNTHETIC_PAYOUT_RATE },
  { symbol: "CCRASH300", name: "Crypto Crash 300 (Synthetic)", base: 3000, volatility: 0.02, spike: "down", brandColor: "#f43f5e", payoutRate: SYNTHETIC_PAYOUT_RATE },
];

export function isSyntheticSymbol(symbol: string): boolean {
  return SYNTHETIC_INSTRUMENTS.some((instrument) => instrument.symbol === symbol);
}

export function findSyntheticInstrument(symbol: string): SyntheticInstrument | undefined {
  return SYNTHETIC_INSTRUMENTS.find((instrument) => instrument.symbol === symbol);
}

/** Stable 32 bit hash, so phases are identical on the server and in the browser. */
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** Deterministic number in the 0 to 1 range for a given label. */
function unit(label: string): number {
  return hash(label) / 4294967296;
}

const OCTAVES = 14;

/**
 * The price at an exact moment in time. Pure maths: same inputs, same output,
 * forever, on any machine.
 */
export function syntheticPrice(symbol: string, atMs: number = Date.now()): number {
  const instrument = findSyntheticInstrument(symbol);
  if (!instrument) return 0;
  const seconds = atMs / 1000;

  let walk = 0;
  let scale = 0;
  for (let octave = 0; octave < OCTAVES; octave += 1) {
    const period = 4 * Math.pow(1.9, octave); // seconds
    const amplitude = Math.sqrt(period);
    const phase = unit(`${instrument.symbol}:${octave}`) * Math.PI * 2;
    walk += amplitude * Math.sin((seconds / period) * Math.PI * 2 + phase);
    scale += amplitude * amplitude;
  }
  walk /= Math.sqrt(scale);

  let level = instrument.base * Math.exp(instrument.volatility * walk * 6);

  if (instrument.spike !== "none") {
    // One in roughly thirty blocks carries a sharp move, decaying over the block.
    const blockSeconds = 30;
    const block = Math.floor(seconds / blockSeconds);
    const roll = unit(`${instrument.symbol}:spike:${block}`);
    if (roll < 0.034) {
      const progress = (seconds - block * blockSeconds) / blockSeconds;
      const strength = 0.05 * (1 - progress);
      level *= instrument.spike === "up" ? 1 + strength : 1 - strength;
    }
  }

  return Math.max(level * 0.0001, level);
}

export type SyntheticCandle = { time: number; open: number; high: number; low: number; close: number };

/** Candles built from the same series the trades settle on. */
export function syntheticCandles(symbol: string, intervalSeconds: number, count: number, endMs: number = Date.now()): SyntheticCandle[] {
  const candles: SyntheticCandle[] = [];
  const step = intervalSeconds * 1000;
  const lastStart = Math.floor(endMs / step) * step;
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = lastStart - index * step;
    const samples: number[] = [];
    const ticks = 12;
    for (let tick = 0; tick <= ticks; tick += 1) {
      const at = Math.min(start + (step * tick) / ticks, endMs);
      samples.push(syntheticPrice(symbol, at));
    }
    candles.push({
      time: Math.floor(start / 1000),
      open: samples[0]!,
      high: Math.max(...samples),
      low: Math.min(...samples),
      close: samples[samples.length - 1]!,
    });
  }
  return candles;
}

/** Percentage move over the last twenty four hours of the series. */
export function syntheticChange24h(symbol: string, atMs: number = Date.now()): number {
  const now = syntheticPrice(symbol, atMs);
  const before = syntheticPrice(symbol, atMs - 86_400_000);
  if (before <= 0) return 0;
  return ((now - before) / before) * 100;
}
