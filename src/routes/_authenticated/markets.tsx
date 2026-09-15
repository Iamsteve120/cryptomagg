import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { StockCard } from "@/components/ui/stock-card";
import { useMarkets } from "@/hooks/use-trading";

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
  const navigate = useNavigate();
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {quotes.map((q) => (
          <StockCard key={q.symbol} ticker={q.symbol} name={q.name} price={q.price} change={q.change24h} points={q.sparkline} payoutRate={q.payoutRate} onBuy={(ticker) => navigate({ to: "/trade", search: { symbol: ticker } })} />
        ))}
      </div>
    </div>
  );
}
