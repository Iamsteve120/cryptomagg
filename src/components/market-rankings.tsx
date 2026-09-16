import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AssetIcon } from "@/components/ui/asset-icon";
import { formatCompactUsd, formatPrice } from "@/lib/assets";
import type { MarketQuote } from "@/lib/market.server";
import { cn } from "@/lib/utils";

type Board = {
  title: string;
  valueLabel: string;
  rows: MarketQuote[];
  value: (quote: MarketQuote) => string;
  pill?: boolean;
};

function Row({ quote, value, pill }: { quote: MarketQuote; value: string; pill?: boolean | undefined }) {
  const up = quote.change24h >= 0;
  return (
    <Link
      to="/trade"
      search={{ symbol: quote.symbol }}
      className="flex items-center gap-3 border-b border-border/70 px-3 py-2.5 last:border-0 hover:bg-accent/50"
    >
      <AssetIcon symbol={quote.symbol} className="size-6" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{quote.name}</span>
        <span className="mt-0.5 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">
          {quote.symbol}USD
        </span>
      </span>
      <span className="num text-right text-xs">
        <span className="block text-foreground">{formatPrice(quote.price)} <span className="text-[9px] text-muted-foreground">USD</span></span>
        {pill ? null : (
          <span className={cn("block", up ? "text-primary" : "text-destructive")}>
            {up ? "+" : ""}{quote.change24h.toFixed(2)}%
          </span>
        )}
      </span>
      {pill ? (
        <span
          className={cn(
            "num rounded px-1.5 py-1 text-[11px] font-semibold",
            up ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground",
          )}
        >
          {up ? "+" : ""}{quote.change24h.toFixed(2)}%
        </span>
      ) : (
        <span className="num w-20 text-right text-xs text-muted-foreground">{value}</span>
      )}
    </Link>
  );
}

function BoardPanel({ board }: { board: Board }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between px-3 pb-2 pt-3">
        <h3 className="flex items-center gap-1 text-base font-semibold text-foreground">
          {board.title}
          <ChevronRight className="size-4 text-muted-foreground" />
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{board.valueLabel}</span>
      </header>
      <div>
        {board.rows.map((quote) => (
          <Row key={quote.symbol} quote={quote} value={board.value(quote)} pill={board.pill} />
        ))}
      </div>
    </section>
  );
}

export function MarketRankings({ quotes, limit = 6 }: { quotes: MarketQuote[]; limit?: number }) {
  if (quotes.length === 0) return null;
  const byCap = [...quotes].sort((a, b) => b.marketCap - a.marketCap).slice(0, limit);
  const byVolume = [...quotes].sort((a, b) => b.volume24h - a.volume24h).slice(0, limit);
  const gainers = [...quotes].sort((a, b) => b.change24h - a.change24h).slice(0, limit);
  const losers = [...quotes].sort((a, b) => a.change24h - b.change24h).slice(0, limit);

  const boards: Board[] = [
    { title: "Market cap ranking", valueLabel: "Market cap", rows: byCap, value: (q) => formatCompactUsd(q.marketCap) },
    { title: "Volume ranking", valueLabel: "24h volume", rows: byVolume, value: (q) => formatCompactUsd(q.volume24h) },
    { title: "Gainers", valueLabel: "24h change", rows: gainers, value: () => "", pill: true },
    { title: "Losers", valueLabel: "24h change", rows: losers, value: () => "", pill: true },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {boards.map((board) => (
        <BoardPanel key={board.title} board={board} />
      ))}
    </div>
  );
}
