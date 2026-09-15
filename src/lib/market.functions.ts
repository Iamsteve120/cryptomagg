import { createServerFn } from "@tanstack/react-start";
import type { MarketQuote } from "./market.server";

export const getMarkets = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ quotes: MarketQuote[]; fetchedAt: string }> => {
    const { fetchMarketQuotes } = await import("./market.server");
    const quotes = await fetchMarketQuotes();
    return { quotes, fetchedAt: new Date().toISOString() };
  },
);
