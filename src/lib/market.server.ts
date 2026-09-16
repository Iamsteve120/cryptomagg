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

async function fetchBinanceQuotes(): Promise<MarketQuote[] | null> {
  const rows = await Promise.all(ASSETS.map(async (asset) => {
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

export async function fetchMarketQuotes(): Promise<MarketQuote[]> {
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

export async function priceForSymbol(symbol: string): Promise<number> {
  const quotes = await fetchMarketQuotes();
  const quote = quotes.find((q) => q.symbol === symbol);
  if (!quote) throw new Error("Unknown asset");
  return quote.price;
}
