import { ASSETS } from "./assets";

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

export async function fetchMarketQuotes(): Promise<MarketQuote[]> {
  const ids = ASSETS.map((a) => a.id).join(",");
  const url =
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" +
    ids +
    "&sparkline=true&price_change_percentage=24h";

  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return fallbackQuotes();
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) return fallbackQuotes();

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
    return quotes;
  } catch {
    return fallbackQuotes();
  }
}

export async function priceForSymbol(symbol: string): Promise<number> {
  const quotes = await fetchMarketQuotes();
  const quote = quotes.find((q) => q.symbol === symbol);
  if (!quote) throw new Error("Unknown asset");
  return quote.price;
}
