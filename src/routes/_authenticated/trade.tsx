import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChangeBadge, PriceText, Sparkline } from "@/components/market-widgets";
import { useAccount, useMarkets } from "@/hooks/use-trading";
import { placeTrade } from "@/lib/trading.functions";
import { ASSETS, DURATIONS, formatMoney, formatPrice } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { useAccountMode } from "@/components/account-mode";

const searchSchema = z.object({ symbol: z.string().optional() });

export const Route = createFileRoute("/_authenticated/trade")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Trade — CryptoMagg" },
      {
        name: "description",
        content:
          "Open simulated up/down crypto trades on live prices with fixed payout rates on CryptoMagg.",
      },
      { property: "og:title", content: "Trade — CryptoMagg" },
      { property: "og:description", content: "Simulated up/down trading on live crypto prices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TradePage,
});

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <span className="num">{left > 0 ? left + "s" : "settling…"}</span>;
}

function TradePage() {
  const { mode } = useAccountMode();
  const { symbol: initialSymbol } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: markets } = useMarkets();
  const { data: account } = useAccount();
  const submit = useServerFn(placeTrade);

  const [symbol, setSymbol] = useState(initialSymbol ?? "BTC");
  const [duration, setDuration] = useState(60);
  const [stake, setStake] = useState("50");

  const quotes = markets?.quotes ?? [];
  const quote = quotes.find((q) => q.symbol === symbol);
  const asset = ASSETS.find((a) => a.symbol === symbol);
  const balance = account?.profile
    ? Number(mode === "demo" ? account.profile.demo_balance : account.profile.live_balance)
    : 0;
  const stakeValue = Number(stake) || 0;
  const payout = asset ? (stakeValue * asset.payoutRate) / 100 : 0;
  const openTrades = (account?.trades ?? []).filter(
    (trade) => trade.status === "open" && trade.account_mode === mode,
  );

  const mutation = useMutation({
    mutationFn: (direction: "up" | "down") =>
      submit({ data: { accountMode: mode, symbol, direction, stake: stakeValue, durationSeconds: duration } }),
    onSuccess: (res) => {
      toast.success(
        `Demo ${res.trade.direction === "up" ? "Up" : "Down"} trade opened on ${res.trade.symbol}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not open the trade."),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Trade</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "demo"
            ? "Predict the direction. Demo trades settle automatically against the live price."
            : "Real trading is locked until account and payment verification is complete."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-xl font-semibold">
                  {quote?.symbol ?? symbol} / USD
                </p>
                <p className="text-xs text-muted-foreground">{quote?.name ?? asset?.name}</p>
              </div>
              <div className="text-right">
                {quote ? <PriceText value={quote.price} /> : <span className="num">—</span>}
                <div className="mt-1">{quote ? <ChangeBadge value={quote.change24h} /> : null}</div>
              </div>
            </div>
            <div className="mt-4 h-40 w-full">
              {quote && quote.sparkline.length > 1 ? (
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full">
                  {(() => {
                    const pts = quote.sparkline;
                    const min = Math.min(...pts);
                    const max = Math.max(...pts);
                    const span = max - min || 1;
                    const d = pts
                      .map((p, i) => {
                        const x = (i / (pts.length - 1)) * 100;
                        const y = 38 - ((p - min) / span) * 34;
                        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
                      })
                      .join(" ");
                    return (
                      <>
                        <path
                          d={`${d} L100,40 L0,40 Z`}
                          className={quote.change24h >= 0 ? "fill-primary/15" : "fill-destructive/15"}
                        />
                        <path
                          d={d}
                          fill="none"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          className={quote.change24h >= 0 ? "stroke-primary" : "stroke-destructive"}
                        />
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <div className="h-40 w-full animate-pulse rounded-lg bg-muted/50" />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4">
            <h2 className="text-lg font-semibold">Open positions</h2>
            {openTrades.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing open right now.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {openTrades.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold">
                        {t.symbol}{" "}
                        <span
                          className={t.direction === "up" ? "text-primary" : "text-destructive"}
                        >
                          {t.direction === "up" ? "▲ Up" : "▼ Down"}
                        </span>
                      </p>
                      <p className="num text-xs text-muted-foreground">
                        Entry ${formatPrice(Number(t.entry_price))} · stake $
                        {formatMoney(Number(t.stake))}
                      </p>
                    </div>
                    <Countdown expiresAt={t.expires_at} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 lg:col-span-2">
          <div className="space-y-2">
            <Label>Asset</Label>
            <div className="grid grid-cols-3 gap-2">
              {ASSETS.map((a) => (
                <Button
                  key={a.symbol}
                  type="button"
                  variant="outline"
                  onClick={() => setSymbol(a.symbol)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                    symbol === a.symbol
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/70 text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  {a.symbol}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Expiry</Label>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map((d) => (
                <Button
                  key={d.seconds}
                  type="button"
                  variant="outline"
                  onClick={() => setDuration(d.seconds)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                    duration === d.seconds
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/70 text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stake">Stake ({mode === "demo" ? "demo USD" : "USDT"})</Label>
            <Input
              id="stake"
              inputMode="decimal"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {[25, 50, 100, 250].map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setStake(String(v))}
                >
                  {mode === "demo" ? "$" : ""}{v}
                </Button>
              ))}
            </div>
          </div>

          <dl className="space-y-1.5 rounded-lg bg-secondary/50 p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payout rate</dt>
              <dd className="num font-semibold text-primary">{asset?.payoutRate ?? 0}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Profit if correct</dt>
               <dd className="num font-semibold text-primary">+{formatMoney(payout)} {mode === "demo" ? "USD" : "USDT"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loss if wrong</dt>
               <dd className="num font-semibold text-destructive">−{formatMoney(stakeValue)} {mode === "demo" ? "USD" : "USDT"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Available</dt>
               <dd className="num font-semibold">{formatMoney(balance)} {mode === "demo" ? "USD" : "USDT"}</dd>
            </div>
          </dl>

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-12 text-base"
              disabled={mode === "live" || mutation.isPending || stakeValue <= 0 || stakeValue > balance}
              onClick={() => mutation.mutate("up")}
            >
              <ArrowUpRight className="size-5" /> Up
            </Button>
            <Button
              variant="destructive"
              className="h-12 text-base"
              disabled={mode === "live" || mutation.isPending || stakeValue <= 0 || stakeValue > balance}
              onClick={() => mutation.mutate("down")}
            >
              <ArrowDownRight className="size-5" /> Down
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            {mode === "demo"
              ? "Demo trade. No real money is placed."
              : "Real trading will unlock only after a regulated provider is connected."}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="text-lg font-semibold">Watchlist</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q) => (
            <li
              key={q.symbol}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-3"
            >
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
      </div>
    </div>
  );
}
