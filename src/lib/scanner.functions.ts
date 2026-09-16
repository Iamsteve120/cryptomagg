import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scanHits = new Map<string, number[]>();

export const scanMarkets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = Date.now();
    const recent = (scanHits.get(context.userId) ?? []).filter((time) => now - time < 60_000);
    if (recent.length >= 5) throw new Error("You have scanned several times. Please wait a minute before scanning again.");
    recent.push(now);
    scanHits.set(context.userId, recent);

    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error("Market analysis is not configured yet.");
    const { analyzeMarketsWithAi } = await import("./scanner.server");
    try {
      return await analyzeMarketsWithAi(apiKey);
    } catch (error) {
      const status = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 402) throw new Error("Market analysis credits are unavailable. The app owner can add credits in Lovable.");
      if (status === 403) throw new Error(error instanceof Error ? error.message : "Market analysis is unavailable by workspace policy.");
      if (status === 429) throw new Error("Market analysis is busy. Please wait before scanning again.");
      throw new Error(error instanceof Error ? error.message : "The market scan could not be completed.");
    }
  });