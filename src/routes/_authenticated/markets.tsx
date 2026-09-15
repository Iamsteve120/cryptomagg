import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChangeBadge, PriceText, Sparkline } from "@/components/market-widgets";
import { useMarkets } from "@/hooks/use-trading";
import { formatMoney } from "@/lib/assets";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({
    meta: [
      { title: "Markets — CryptoMagg" },
      {
        name: "description",
        content: "Live crypto prices, 24h moves and payout rates for CryptoMagg simulated trades.",
      },
      { property: "og:title", content: "Markets — CryptoMagg" },
      { property: "og:description", content: "Live crypto prices and simulated payout rates." },
    ],
  }),
  component: Markets,
});

function Markets() {
  const { data, isFetching } = useMarkets();
  const [query, setQuery] = useState("");
  const quotes = (data?.quotes ?? []).filter((q) =>
    (q.symbol + q.name).toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Markets</h1>
          <p className="text-sm text-muted-foreground">
            {isFetching ? "Refreshing live prices…" : "Live prices, refreshed automatically."}
          </p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search asset"
          className="w-full sm:w-64"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">24h</th>
              <th className="px-4 py-3">24h high / low</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Trend</th>
              <th className="px-4 py-3 text-right">Payout</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.symbol} className="border-t border-border/60">
                <td className="px-4 py-3">
                  <p className="font-semibold">{q.symbol}</p>
                  <p className="text-xs text-muted-foreground">{q.name}</p>
                </td>
                <td className="px-4 py-3">
                  <PriceText value={q.price} />
                </td>
                <td className="px-4 py-3">
                  <ChangeBadge value={q.change24h} />
                </td>
                <td className="num px-4 py-3 text-xs text-muted-foreground">
                  ${formatMoney(q.high24h)} / ${formatMoney(q.low24h)}
                </td>
                <td className="num px-4 py-3 text-xs text-muted-foreground">
                  ${formatMoney(q.volume24h / 1_000_000, 1)}M
                </td>
                <td className="px-4 py-3">
                  <Sparkline points={q.sparkline} up={q.change24h >= 0} />
                </td>
                <td className="num px-4 py-3 text-right font-semibold text-primary">
                  {q.payoutRate}%
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/trade" search={{ symbol: q.symbol }}>
                      Trade
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
