import { createServerFn } from "@tanstack/react-start";
import type { MarketQuote } from "./market.server";

export const getMarkets = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ quotes: MarketQuote[]; fetchedAt: string }> => {
    const { fetchMarketQuotes } = await import("./market.server");
    const quotes = await fetchMarketQuotes();
    return { quotes, fetchedAt: new Date().toISOString() };
  },
);

export const getUsdKesRate = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { rate: null, fetchedAt: null };
    const payload = (await response.json()) as { rates?: { KES?: number }; time_last_update_utc?: string };
    const rate = Number(payload.rates?.KES);
    return {
      rate: Number.isFinite(rate) && rate > 0 ? rate : null,
      fetchedAt: payload.time_last_update_utc ?? null,
    };
  } catch {
    return { rate: null, fetchedAt: null };
  }
});
