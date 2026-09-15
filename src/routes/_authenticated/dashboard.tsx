import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ChangeBadge, PriceText, Sparkline, StatCard } from "@/components/market-widgets";
import { useAccount, useMarkets } from "@/hooks/use-trading";
import { formatMoney, formatPrice } from "@/lib/assets";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CryptoMagg" },
      {
        name: "description",
        content: "Your CryptoMagg demo balance, open positions and simulated performance.",
      },
      { property: "og:title", content: "Dashboard — CryptoMagg" },
      { property: "og:description", content: "Track your simulated trading performance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: account } = useAccount();
  const { data: markets } = useMarkets();
  const quotes = markets?.quotes ?? [];
  const profile = account?.profile;
  const stats = account?.stats;
  const openTrades = (account?.trades ?? []).filter((t) => t.status === "open");
  const movers = [...quotes].sort((a, b) => b.change24h - a.change24h).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back{profile?.full_name ? ", " + profile.full_name.split(" ")[0] : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            All balances and trades below are simulated.
          </p>
        </div>
        <Button asChild>
          <Link to="/trade">Place a trade</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Demo balance"
          value={profile ? "$" + formatMoney(Number(profile.demo_balance)) : "—"}
          hint="Simulated funds"
          tone="positive"
        />
        <StatCard
          label="Net P/L"
          value={stats ? (stats.netPnl >= 0 ? "+" : "-") + "$" + formatMoney(Math.abs(stats.netPnl)) : "—"}
          hint="Across settled trades"
          tone={stats && stats.netPnl < 0 ? "negative" : "positive"}
        />
        <StatCard label="Win rate" value={stats ? stats.winRate + "%" : "—"} hint="Settled trades" />
        <StatCard
          label="Open positions"
          value={stats ? String(stats.openTrades) : "—"}
          hint="Settling automatically"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">Open positions</h2>
          {openTrades.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No open positions. Head to Trade to open a simulated up/down position.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/60">
              {openTrades.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">
                      {t.symbol}{" "}
                      <span className={t.direction === "up" ? "text-primary" : "text-destructive"}>
                        {t.direction === "up" ? "▲ Up" : "▼ Down"}
                      </span>
                    </p>
                    <p className="num text-xs text-muted-foreground">
                      Entry ${formatPrice(Number(t.entry_price))} · {t.duration_seconds}s
                    </p>
                  </div>
                  <p className="num text-sm font-semibold">${formatMoney(Number(t.stake))}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <h2 className="text-lg font-semibold">Top movers</h2>
          <ul className="mt-4 space-y-3">
            {movers.map((q) => (
              <li key={q.symbol} className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{q.symbol}</p>
                  <PriceText value={q.price} />
                </div>
                <div className="flex items-center gap-2">
                  <Sparkline points={q.sparkline} up={q.change24h >= 0} />
                  <ChangeBadge value={q.change24h} />
                </div>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/markets">View all markets</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
