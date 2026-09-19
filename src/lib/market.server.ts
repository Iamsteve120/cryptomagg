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
  await Promise.all(ASSETS.filter((asset) => asset.tradable !== false).map(async (asset) => {
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

/** One request returns fresh prices for every tradable pair, so live PNL moves on each poll. */
async function fetchBinanceTickerQuotes(): Promise<MarketQuote[] | null> {
  const tradable = ASSETS.filter((asset) => asset.tradable !== false);
  const symbols = JSON.stringify(tradable.map((asset) => `${asset.symbol}USDT`));
  const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const rows = await response.json() as Array<Record<string, unknown>>;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  await refreshSparklines();
  const quotes = ASSETS.map((asset) => {
    if (asset.tradable === false) {
      return {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        price: asset.fallbackPrice,
        change24h: 0,
        high24h: asset.fallbackPrice,
        low24h: asset.fallbackPrice,
        volume24h: 0,
        marketCap: 0,
        sparkline: Array.from({ length: 8 }, () => asset.fallbackPrice),
        payoutRate: asset.payoutRate,
        live: false,
      } satisfies MarketQuote;
    }
    const row = rows.find((item) => item["symbol"] === `${asset.symbol}USDT`);
    const price = Number(row?.["lastPrice"] ?? 0);
    const previous = lastSuccessfulQuotes?.find((item) => item.symbol === asset.symbol);
    if (!row || !Number.isFinite(price) || price <= 0) {
      return previous ?? fallbackQuotes().find((item) => item.id === asset.id)!;
    }
    const sparkline = sparklineCache.get(asset.symbol) ?? previous?.sparkline ?? [];
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      price,
      change24h: Number(row["priceChangePercent"] ?? 0),
      high24h: Number(row["highPrice"] ?? price),
      low24h: Number(row["lowPrice"] ?? price),
      volume24h: Number(row["quoteVolume"] ?? 0),
      marketCap: previous?.marketCap ?? 0,
      sparkline: [...sparkline.slice(0, -1), price],
      payoutRate: asset.payoutRate,
      live: true,
    } satisfies MarketQuote;
  });
  return quotes.filter((quote) => quote.live).length >= 3 ? quotes : null;
}

async function fetchBinanceQuotes(): Promise<MarketQuote[] | null> {
  const rows = await Promise.all(ASSETS.map(async (asset) => {
    if (asset.tradable === false) {
      // Stablecoins have no USDT pair; they are listed for reference only.
      const pegged: MarketQuote = {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        price: asset.fallbackPrice,
        change24h: 0,
        high24h: asset.fallbackPrice,
        low24h: asset.fallbackPrice,
        volume24h: 0,
        marketCap: 0,
        sparkline: Array.from({ length: 8 }, () => asset.fallbackPrice),
        payoutRate: asset.payoutRate,
        live: false,
      };
      return pegged;
    }
    const pair = `${asset.symbol}USDT`;
    const [tickerResponse, candlesResponse] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { headers: { accept: "application/json" } }),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=5m&limit=60`, { headers: { accept: "application/json" } }),
    ]);
    if (!tickerResponse.ok || !candlesResponse.ok) return null;
    const ticker = await tickerResponse.json() as Record<string, unknown>;
    const candles = await candlesResponse.json() as unknown[][];
    const sparkline = candles.map((candle) => Number(candle[4])).filter((price) => Number.isFinite(price) && price > 0);
    const price = Number(ticker["lastPrice"]);
    if (!Number.isFinite(price) || price <= 0 || sparkline.length < 6) return null;
    const quote: MarketQuote = {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      price,
      change24h: Number(ticker["priceChangePercent"] ?? 0),
      high24h: Number(ticker["highPrice"] ?? price),
      low24h: Number(ticker["lowPrice"] ?? price),
      volume24h: Number(ticker["quoteVolume"] ?? 0),
      marketCap: 0,
      sparkline,
      payoutRate: asset.payoutRate,
      live: true,
    };
    return quote;
  }));
  const available = rows.filter((row): row is NonNullable<typeof row> => row !== null);
  return available.length >= 3 ? available : null;
}

async function fetchExchangeQuotes(): Promise<MarketQuote[]> {
  // Fast tick source first: prices refresh on every poll so live PNL moves immediately.
  try {
    const ticker = await fetchBinanceTickerQuotes();
    if (ticker) {
      lastSuccessfulQuotes = ticker;
      return ticker;
    }
  } catch {
    // Fall through to the slower reference source.
  }

  const ids = ASSETS.map((a) => a.id).join(",");
  const url =
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" +
    ids +
    "&sparkline=true&price_change_percentage=24h";

  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("Primary market source unavailable");
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("Primary market source returned no prices");

    const quotes = ASSETS.map((a) => {
      const row = rows.find((r) => r["id"] === a.id);
      if (!row) {
        return { ...fallbackQuotes().find((q) => q.id === a.id)! };
      }
      const spark = (row["sparkline_in_7d"] as { price?: number[] } | undefined)?.price ?? [];
      return {
        id: a.id,
        symbol: a.symbol,
        name: a.name,
        price: Number(row["current_price"] ?? a.fallbackPrice),
        change24h: Number(row["price_change_percentage_24h"] ?? 0),
        high24h: Number(row["high_24h"] ?? 0),
        low24h: Number(row["low_24h"] ?? 0),
        volume24h: Number(row["total_volume"] ?? 0),
        marketCap: Number(row["market_cap"] ?? 0),
        sparkline: spark.slice(-60).map((p) => Number(p)),
        payoutRate: a.payoutRate,
        live: true,
      } satisfies MarketQuote;
    });
    lastSuccessfulQuotes = quotes;
    return quotes;
  } catch {
    try {
      const backup = await fetchBinanceQuotes();
      if (backup) {
        lastSuccessfulQuotes = backup;
        return backup;
      }
    } catch {
      // The last successful snapshot keeps the simulator readable during provider interruptions.
    }
    return lastSuccessfulQuotes ?? fallbackQuotes();
  }
}

/** Quotes for the generated crypto instruments, computed from the clock alone. */
function syntheticQuotes(): MarketQuote[] {
  const now = Date.now();
  return SYNTHETIC_INSTRUMENTS.map((instrument) => {
    const price = syntheticPrice(instrument.symbol, now);
    const candles = syntheticCandles(instrument.symbol, 60, 60, now);
    const closes = candles.map((candle) => candle.close);
    return {
      id: instrument.symbol.toLowerCase(),
      symbol: instrument.symbol,
      name: instrument.name,
      price,
      change24h: syntheticChange24h(instrument.symbol, now),
      high24h: Math.max(...closes, price),
      low24h: Math.min(...closes, price),
      volume24h: 0,
      marketCap: 0,
      sparkline: closes,
      payoutRate: instrument.payoutRate,
      live: true,
      synthetic: true,
    } satisfies MarketQuote;
  });
}

/** Exchange pairs plus the generated instruments, in one list. */
export async function fetchMarketQuotes(): Promise<MarketQuote[]> {
  const exchange = await fetchExchangeQuotes();
  return [...exchange, ...syntheticQuotes()];
}

export async function priceForSymbol(symbol: string): Promise<number> {
  if (isSyntheticSymbol(symbol)) return syntheticPrice(symbol);
  const quotes = await fetchExchangeQuotes();
  const quote = quotes.find((q) => q.symbol === symbol);
  if (!quote) throw new Error("Unknown asset");
  return quote.price;
}
