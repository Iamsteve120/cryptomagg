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

export async function analyzeMarketsWithAi(apiKey: string) {
  const quotes = await fetchMarketQuotes();
  const liveQuotes = quotes.filter((quote) => quote.live && quote.sparkline.length >= 6);
  if (liveQuotes.length < 3) throw new Error("Live market data is temporarily unavailable. Please scan again later.");

  const snapshot = liveQuotes.map((quote) => ({
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
    const selected = liveQuotes.find((quote) => quote.symbol === output.symbol);
    if (!selected) throw new Error("The scan returned an unavailable market.");
    return {
      ...output,
      confidence: Math.max(0, Math.min(95, Math.round(output.confidence))),
      price: selected.price,
      change24h: selected.change24h,
      scannedAt: new Date().toISOString(),
      marketsScanned: liveQuotes.length,
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("The market scan could not produce a reliable setup. Please try again later.");
    }
    throw error;
  }
}