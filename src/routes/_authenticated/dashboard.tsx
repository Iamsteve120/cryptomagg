import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/market-widgets";
import { useAccount, useMarkets } from "@/hooks/use-trading";
import { formatMoney, formatPrice } from "@/lib/assets";
import { CryptoCard } from "@/components/ui/asset-card";
import { useAccountMode } from "@/components/account-mode";
import { calculateLivePnl } from "@/lib/trade-pnl";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | CryptoMagg" },
      {
        name: "description",
        content: "Your CryptoMagg demo balance, open positions and simulated performance.",
      },
      { property: "og:title", content: "Dashboard | CryptoMagg" },
      { property: "og:description", content: "Track your simulated trading performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { mode } = useAccountMode();
  const { data: account } = useAccount();
  const { data: markets } = useMarkets();
  const quotes = markets?.quotes ?? [];
  const profile = account?.profile;
  const accountTrades = (account?.trades ?? []).filter((trade) => trade.account_mode === mode);
  const openTrades = accountTrades.filter((trade) => trade.status === "open");
  const settledTrades = accountTrades.filter((trade) => trade.status !== "open");
  const wonTrades = settledTrades.filter((trade) => trade.status === "won");
  const netPnl = settledTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
  const winRate = settledTrades.length > 0 ? Math.round((wonTrades.length / settledTrades.length) * 100) : 0;
  const movers = [...quotes].sort((a, b) => b.change24h - a.change24h).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back{profile?.full_name ? ", " + profile.full_name.split(" ")[0] : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "demo" ? "Practice with simulated funds." : "Real account balances are held in USDT."}
          </p>
        </div>
        <Button asChild>
          <Link to="/trade">Place a trade</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={mode === "demo" ? "Demo balance" : "Real balance"}
          value={profile ? (mode === "demo" ? "$" + formatMoney(Number(profile.demo_balance)) : formatMoney(Number(profile.live_balance)) + " USDT") : "Unavailable"}
          hint={mode === "demo" ? "Simulated funds" : "Verification required"}
          tone="positive"
        />
        <StatCard
          label="Net P/L"
          value={(netPnl >= 0 ? "+" : "minus ") + formatMoney(Math.abs(netPnl)) + (mode === "demo" ? " USD" : " USDT")}
          hint="Across settled trades"
          tone={netPnl < 0 ? "negative" : "positive"}
        />
        <StatCard label="Win rate" value={winRate + "%"} hint="Settled trades" />
        <StatCard
          label="Open positions"
          value={String(openTrades.length)}
          hint="Settling automatically"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">Open positions</h2>
          {openTrades.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {mode === "demo"
                ? "No open positions. Head to Trade to open a demo position."
                : "Real trading remains locked until verification is complete."}
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
                    <p className="num text-xs text-muted-foreground">Entry ${formatPrice(Number(t.entry_price))} | Live ${formatPrice(quotes.find((quote) => quote.symbol === t.symbol)?.price ?? Number(t.entry_price))} | {t.duration_seconds}s</p>
                  </div>
                  {(() => { const pnl = calculateLivePnl(t, quotes.find((quote) => quote.symbol === t.symbol)?.price); return <div className="text-right"><p className="text-xs text-muted-foreground">Live PNL</p><p className={pnl >= 0 ? "num font-semibold text-primary" : "num font-semibold text-destructive"}>{pnl >= 0 ? "+" : "minus "}{formatMoney(Math.abs(pnl))} USD</p></div>; })()}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <h2 className="text-lg font-semibold">Top movers</h2>
          <div className="mt-4 space-y-3">
            {movers.slice(0, 2).map((q) => (
              <CryptoCard key={q.symbol} ticker={q.symbol} name={q.name} currentPrice={q.price} percentageChange={q.change24h} points={q.sparkline} payoutRate={q.payoutRate} onTrade={(ticker) => navigate({ to: "/trade", search: { symbol: ticker } })} />
            ))}
          </div>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/markets">View all markets</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
