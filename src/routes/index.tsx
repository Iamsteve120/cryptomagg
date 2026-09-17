import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Activity, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { DemoFooter } from "@/components/demo-banner";
import { ChangeBadge, PriceText, Sparkline } from "@/components/market-widgets";
import { useMarkets } from "@/hooks/use-trading";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CryptoMagg | Practise Crypto Trading" },
      {
        name: "description",
        content:
          "CryptoMagg is a crypto trading simulator with live market prices, simulated deposits and up/down trades. No real money is involved.",
      },
      { property: "og:title", content: "CryptoMagg | Crypto Trading Simulator" },
      {
        property: "og:description",
        content:
          "Live market prices, simulated wallet and up/down trades. Practise trading with zero risk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data } = useMarkets();
  const quotes = data?.quotes ?? [];

  return (
    <div className="min-h-screen">
      <DemoBanner />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <BrandLogo size="md" />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Start demo</Link>
          </Button>
        </div>
      </header>

      <section className="grid-glow border-y border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Activity className="size-3.5" /> Live prices · simulated money
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl">
            Learn the market. <span className="text-primary">Build your trading discipline.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            CryptoMagg mirrors real market movement from a live price feed, then lets you practise
            up/down trades, deposits and withdrawals with a $10,000 demo balance.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Create free demo account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Explore the markets</Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Activity, title: "Real market data", body: "Live prices across 10 major coins." },
              { icon: Wallet, title: "Simulated wallet", body: "Deposits and withdrawals that move demo funds only." },
              { icon: ShieldCheck, title: "Zero risk", body: "No payments, no real wallets, no exposure." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-border/70 bg-card/70 p-4">
                <f.icon className="size-5 text-primary" />
                <p className="mt-3 font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Live markets</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Prices update automatically. Payout rates apply to simulated trades.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">24h</th>
                <th className="hidden px-4 py-3 sm:table-cell">7d trend</th>
                <th className="px-4 py-3 text-right">Payout</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
                      </td>
                    </tr>
                  ))
                : quotes.map((q) => (
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
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Sparkline points={q.sparkline} up={q.change24h >= 0} />
                      </td>
                      <td className="num px-4 py-3 text-right font-semibold text-primary">
                        {q.payoutRate}%
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      <DemoFooter />
    </div>
  );
}
