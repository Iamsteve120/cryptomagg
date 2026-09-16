import { Output, NoObjectGeneratedError, streamText } from "ai";
import { z } from "zod";
import { createScannerAi } from "./ai-gateway.server";
import { fetchMarketQuotes } from "./market.server";

const ScanOutput = z.object({
  symbol: z.enum(["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "DOT"]),
  direction: z.enum(["up", "down", "wait"]),
  confidence: z.number(),
  durationSeconds: z.union([z.literal(30), z.literal(60), z.literal(300), z.literal(900)]),
  marketCondition: z.string(),
  rationale: z.string(),
  riskNote: z.string(),
});

function momentum(points: number[]) {
  if (points.length < 6) return 0;
  const sample = points.slice(-12);
  const first = sample[0] ?? 0;
  const last = sample.at(-1) ?? first;
  return first > 0 ? ((last / first) - 1) * 100 : 0;
}

function localAnalysis(quotes: Awaited<ReturnType<typeof fetchMarketQuotes>>) {
  const ranked = quotes
    .map((quote) => ({ quote, move: momentum(quote.sparkline) }))
    .sort((a, b) => Math.abs(b.move) - Math.abs(a.move));
  const strongest = ranked[0];
  if (!strongest || Math.abs(strongest.move) < 0.02) {
    const quote = strongest?.quote ?? quotes[0];
    return {
      symbol: quote?.symbol ?? "BTC",
      direction: "wait" as const,
      confidence: 45,
      durationSeconds: 60 as const,
      marketCondition: "No clear short term momentum",
      rationale: "Current market movement is too limited or mixed for a supported Demo setup.",
      riskNote: "Wait for clearer price movement before placing a Demo trade.",
    };
  }
  const agreement = Math.sign(strongest.move) === Math.sign(strongest.quote.change24h);
  return {
    symbol: strongest.quote.symbol as "BTC" | "ETH" | "SOL" | "BNB" | "XRP" | "ADA" | "DOGE" | "AVAX" | "LINK" | "DOT",
    direction: strongest.move > 0 ? "up" as const : "down" as const,
    confidence: Math.min(82, Math.round(58 + Math.abs(strongest.move) * 10 + (agreement ? 8 : 0))),
    durationSeconds: Math.abs(strongest.move) > 0.4 ? 60 as const : 300 as const,
    marketCondition: agreement ? "Momentum follows the daily direction" : "Short term momentum differs from the daily direction",
    rationale: `${strongest.quote.symbol} has the clearest recent price movement among the available markets.`,
    riskNote: "Momentum can reverse before expiry. Keep the Demo stake within your limit.",
  };
}

export async function analyzeMarketsWithAi(apiKey: string) {
  const quotes = await fetchMarketQuotes();
  const liveQuotes = quotes.filter((quote) => quote.live && quote.sparkline.length >= 6);
  const usableQuotes = liveQuotes.length >= 3 ? liveQuotes : quotes.filter((quote) => quote.sparkline.length >= 6);
  if (usableQuotes.length < 3) {
    const fallback = localAnalysis(quotes);
    const selected = quotes.find((quote) => quote.symbol === fallback.symbol) ?? quotes[0];
    return { ...fallback, price: selected?.price ?? 0, change24h: selected?.change24h ?? 0, scannedAt: new Date().toISOString(), marketsScanned: quotes.length };
  }

  const snapshot = usableQuotes.map((quote) => ({
    symbol: quote.symbol,
    price: quote.price,
    change24hPercent: Number(quote.change24h.toFixed(3)),
    recentMomentumPercent: Number(momentum(quote.sparkline).toFixed(3)),
    distanceFromDayLowPercent: quote.low24h > 0 ? Number((((quote.price / quote.low24h) - 1) * 100).toFixed(3)) : 0,
    distanceFromDayHighPercent: quote.high24h > 0 ? Number((((quote.high24h / quote.price) - 1) * 100).toFixed(3)) : 0,
    volume24hUsd: Math.round(quote.volume24h),
  }));

  const lovable = createScannerAi(apiKey);
  const result = streamText({
    model: lovable.responses("openai/gpt-6-astra"),
    output: Output.object({ schema: ScanOutput }),
    system: "You are a cautious market pattern analyst inside a paper trading simulator. Analyze only the supplied numeric snapshot. Never claim certainty, guaranteed profit, insider information, or future knowledge. Choose wait when evidence conflicts or confidence is below 60. Keep rationale under 35 words and riskNote under 25 words. This is educational analysis, not financial advice.",
    prompt: `Return the strongest current simulated setup from this market snapshot. Compare daily movement, recent momentum, daily range position, and liquidity. Pick one supported duration. Data: ${JSON.stringify(snapshot)}`,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  try {
    const output = await result.output;
    const selected = usableQuotes.find((quote) => quote.symbol === output.symbol);
    if (!selected) throw new Error("The scan returned an unavailable market.");
    return {
      ...output,
      confidence: Math.max(0, Math.min(95, Math.round(output.confidence))),
      price: selected.price,
      change24h: selected.change24h,
      scannedAt: new Date().toISOString(),
      marketsScanned: usableQuotes.length,
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const fallback = localAnalysis(usableQuotes);
      const selected = usableQuotes.find((quote) => quote.symbol === fallback.symbol) ?? usableQuotes[0];
      return { ...fallback, price: selected?.price ?? 0, change24h: selected?.change24h ?? 0, scannedAt: new Date().toISOString(), marketsScanned: usableQuotes.length };
    }
    const fallback = localAnalysis(usableQuotes);
    const selected = usableQuotes.find((quote) => quote.symbol === fallback.symbol) ?? usableQuotes[0];
    return { ...fallback, price: selected?.price ?? 0, change24h: selected?.change24h ?? 0, scannedAt: new Date().toISOString(), marketsScanned: usableQuotes.length };
  }
}