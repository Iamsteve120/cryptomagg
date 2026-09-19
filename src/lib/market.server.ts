import { ASSETS } from "./assets";

let lastSuccessfulQuotes: MarketQuote[] | null = null;

export type MarketQuote = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
  sparkline: number[];
  payoutRate: number;
  live: boolean;
};

type RawTicker = {
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
};

const TRADABLE = ASSETS.filter((asset) => asset.tradable !== false);

function fallbackQuotes(): MarketQuote[] {
  return ASSETS.map((a) => ({
    id: a.id,
    symbol: a.symbol,
    name: a.name,
    price: a.fallbackPrice,
    change24h: 0,
    high24h: a.fallbackPrice,
    low24h: a.fallbackPrice,
    volume24h: 0,
    marketCap: 0,
    sparkline: [],
    payoutRate: a.payoutRate,
    live: false,
  }));
}

/** Sparkline candles change slowly, so they are cached while prices refresh on every request. */
const sparklineCache = new Map<string, number[]>();
let sparklineFetchedAt = 0;

async function refreshSparklines() {
  if (Date.now() - sparklineFetchedAt < 60_000 && sparklineCache.size > 0) return;
  sparklineFetchedAt = Date.now();
  await Promise.all(TRADABLE.map(async (asset) => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${asset.symbol}USDT&interval=1m&limit=60`, { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const candles = await response.json() as unknown[][];
      const closes = candles.map((candle) => Number(candle[4])).filter((price) => Number.isFinite(price) && price > 0);
      if (closes.length >= 6) sparklineCache.set(asset.symbol, closes);
    } catch {
      // Keep the previous candles when the provider is briefly unavailable.
    }
  }));
}

/**
 * Circulating supply per coin, refreshed every ten minutes. Market cap is then
 * supply times the live price, so the cap always agrees with the price shown.
 */
const supplyCache = new Map<string, number>();
let supplyFetchedAt = 0;

async function refreshSupplies() {
  if (Date.now() - supplyFetchedAt < 600_000 && supplyCache.size > 0) return;
  supplyFetchedAt = Date.now();
  try {
    const ids = ASSETS.map((asset) => asset.id).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250`,
      { headers: { accept: "application/json" } },
    );
    if (!response.ok) return;
    const rows = (await response.json()) as Array<Record<string, unknown>>;
    for (const row of rows) {
      const supply = Number(row["circulating_supply"]);
      const id = String(row["id"] ?? "");
      if (id && Number.isFinite(supply) && supply > 0) supplyCache.set(id, supply);
    }
  } catch {
    // Keep the previous supplies when the reference provider is unavailable.
  }
}

function marketCapFor(id: string, price: number, previous?: number) {
  const supply = supplyCache.get(id);
  if (supply && Number.isFinite(price) && price > 0) return supply * price;
  return previous ?? 0;
}

function usable(ticker: RawTicker | undefined): ticker is RawTicker {
  return !!ticker && Number.isFinite(ticker.price) && ticker.price > 0;
}

/** Spot exchange sources, tried in order. Each returns real last price, 24h move, range and volume. */
async function binanceTickers(): Promise<Map<string, RawTicker>> {
  const symbols = JSON.stringify(TRADABLE.map((asset) => `${asset.symbol}USDT`));
  const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`binance ${response.status}`);
  const rows = await response.json() as Array<Record<string, unknown>>;
  const out = new Map<string, RawTicker>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const pair = String(row["symbol"] ?? "");
    if (!pair.endsWith("USDT")) continue;
    out.set(pair.slice(0, -4), {
      price: Number(row["lastPrice"]),
      change24h: Number(row["priceChangePercent"] ?? 0),
      high24h: Number(row["highPrice"] ?? 0),
      low24h: Number(row["lowPrice"] ?? 0),
      volume24h: Number(row["quoteVolume"] ?? 0),
    });
  }
  return out;
}

async function bybitTickers(): Promise<Map<string, RawTicker>> {
  const response = await fetch("https://api.bybit.com/v5/market/tickers?category=spot", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`bybit ${response.status}`);
  const body = await response.json() as { result?: { list?: Array<Record<string, unknown>> } };
  const out = new Map<string, RawTicker>();
  for (const row of body.result?.list ?? []) {
    const pair = String(row["symbol"] ?? "");
    if (!pair.endsWith("USDT")) continue;
    out.set(pair.slice(0, -4), {
      price: Number(row["lastPrice"]),
      change24h: Number(row["price24hPcnt"] ?? 0) * 100,
      high24h: Number(row["highPrice24h"] ?? 0),
      low24h: Number(row["lowPrice24h"] ?? 0),
      volume24h: Number(row["turnover24h"] ?? 0),
    });
  }
  return out;
}

async function okxTickers(): Promise<Map<string, RawTicker>> {
  const response = await fetch("https://www.okx.com/api/v5/market/tickers?instType=SPOT", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`okx ${response.status}`);
  const body = await response.json() as { data?: Array<Record<string, unknown>> };
  const out = new Map<string, RawTicker>();
  for (const row of body.data ?? []) {
    const instId = String(row["instId"] ?? "");
    if (!instId.endsWith("-USDT")) continue;
    const price = Number(row["last"]);
    const open = Number(row["open24h"]);
    out.set(instId.slice(0, -5), {
      price,
      change24h: Number.isFinite(open) && open > 0 ? ((price - open) / open) * 100 : 0,
      high24h: Number(row["high24h"] ?? 0),
      low24h: Number(row["low24h"] ?? 0),
      volume24h: Number(row["volCcy24h"] ?? 0),
    });
  }
  return out;
}

async function coingeckoTickers(): Promise<Map<string, RawTicker>> {
  const ids = ASSETS.map((asset) => asset.id).join(",");
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`coingecko ${response.status}`);
  const rows = await response.json() as Array<Record<string, unknown>>;
  const out = new Map<string, RawTicker>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const asset = ASSETS.find((item) => item.id === String(row["id"] ?? ""));
    if (!asset) continue;
    out.set(asset.symbol, {
      price: Number(row["current_price"]),
      change24h: Number(row["price_change_percentage_24h"] ?? 0),
      high24h: Number(row["high_24h"] ?? 0),
      low24h: Number(row["low_24h"] ?? 0),
      volume24h: Number(row["total_volume"] ?? 0),
    });
  }
  return out;
}

/** Merge every reachable source so each coin shows a real traded price. */
async function collectTickers(): Promise<Map<string, RawTicker>> {
  const merged = new Map<string, RawTicker>();
  for (const source of [binanceTickers, bybitTickers, okxTickers, coingeckoTickers]) {
    const missing = TRADABLE.filter((asset) => !usable(merged.get(asset.symbol)));
    if (missing.length === 0) break;
    try {
      const tickers = await source();
      for (const asset of missing) {
        const ticker = tickers.get(asset.symbol);
        if (usable(ticker)) merged.set(asset.symbol, ticker);
      }
    } catch {
      // Try the next exchange.
    }
  }
  return merged;
}

/** Quotes are shared for a moment so rapid polling never trips exchange rate limits. */
let cachedQuotes: { quotes: MarketQuote[]; at: number } | null = null;
let inFlight: Promise<MarketQuote[]> | null = null;

async function buildQuotes(): Promise<MarketQuote[]> {
  const tickers = await collectTickers();
  if (tickers.size === 0) return lastSuccessfulQuotes ?? fallbackQuotes();
  await Promise.all([refreshSparklines(), refreshSupplies()]);

  const quotes = ASSETS.map((asset) => {
    const previous = lastSuccessfulQuotes?.find((item) => item.symbol === asset.symbol);
    if (asset.tradable === false) {
      // Stablecoins are listed for reference only; they have no traded USDT pair.
      return {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        price: asset.fallbackPrice,
        change24h: 0,
        high24h: asset.fallbackPrice,
        low24h: asset.fallbackPrice,
        volume24h: 0,
        marketCap: marketCapFor(asset.id, asset.fallbackPrice, previous?.marketCap),
        sparkline: Array.from({ length: 8 }, () => asset.fallbackPrice),
        payoutRate: asset.payoutRate,
        live: false,
      } satisfies MarketQuote;
    }
    const ticker = tickers.get(asset.symbol);
    if (!usable(ticker)) {
      return previous ?? fallbackQuotes().find((item) => item.id === asset.id)!;
    }
    const sparkline = sparklineCache.get(asset.symbol) ?? previous?.sparkline ?? [];
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      price: ticker.price,
      change24h: ticker.change24h,
      high24h: ticker.high24h > 0 ? ticker.high24h : ticker.price,
      low24h: ticker.low24h > 0 ? ticker.low24h : ticker.price,
      volume24h: ticker.volume24h,
      marketCap: marketCapFor(asset.id, ticker.price, previous?.marketCap),
      sparkline: sparkline.length > 0 ? [...sparkline.slice(0, -1), ticker.price] : [ticker.price],
      payoutRate: asset.payoutRate,
      live: true,
    } satisfies MarketQuote;
  });

  if (quotes.some((quote) => quote.live)) lastSuccessfulQuotes = quotes;
  return quotes;
}

async function fetchExchangeQuotes(): Promise<MarketQuote[]> {
  if (cachedQuotes && Date.now() - cachedQuotes.at < 1_000) return cachedQuotes.quotes;
  if (inFlight) return inFlight;
  inFlight = buildQuotes()
    .then((quotes) => {
      cachedQuotes = { quotes, at: Date.now() };
      return quotes;
    })
    .catch(() => lastSuccessfulQuotes ?? fallbackQuotes())
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Live quotes for the real crypto pairs. */
export async function fetchMarketQuotes(): Promise<MarketQuote[]> {
  return fetchExchangeQuotes();
}

export async function priceForSymbol(symbol: string): Promise<number> {
  const quotes = await fetchExchangeQuotes();
  const quote = quotes.find((q) => q.symbol === symbol);
  if (!quote) throw new Error("Unknown asset");
  return quote.price;
}
