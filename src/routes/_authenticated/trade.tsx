import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AssetIcon } from "@/components/ui/asset-icon";
import { ChangeBadge, PriceText, Sparkline } from "@/components/market-widgets";
import { useAccount, useMarkets } from "@/hooks/use-trading";
import { placeTrade, stopDemoTrade } from "@/lib/trading.functions";
import { ASSETS, DURATIONS, formatMoney, formatPrice } from "@/lib/assets";
import { calculateLivePnl } from "@/lib/trade-pnl";
import { cn } from "@/lib/utils";
import { useAccountMode } from "@/components/account-mode";
import { MarketScanner } from "@/components/market-scanner";

const searchSchema = z.object({ symbol: z.string().optional() });
type Direction = "up" | "down";
type TradeSource = "manual" | "assist" | "auto" | "scanner";

export const Route = createFileRoute("/_authenticated/trade")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Trade | CryptoMagg" },
      { name: "description", content: "Open simulated crypto trades on live prices with transparent market signals." },
      { property: "og:title", content: "Trade | CryptoMagg" },
      { property: "og:description", content: "Simulated crypto trading with transparent market signals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TradePage,
});

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  return <span className="num">{left > 0 ? left + "s" : "Settling"}</span>;
}

function ActivePosition({ trade, currentPrice, stopping, onStop }: { trade: NonNullable<ReturnType<typeof useAccount>["data"]>["trades"][number]; currentPrice: number | undefined; stopping: boolean; onStop: () => void }) {
  const entry = Number(trade.entry_price);
  const hasLevels = trade.take_profit_price !== null && trade.stop_loss_price !== null;
  const tp = hasLevels ? Number(trade.take_profit_price) : entry;
  const sl = hasLevels ? Number(trade.stop_loss_price) : entry;
  const price = currentPrice ?? entry;
  const movement = trade.direction === "up" ? price - entry : entry - price;
  const targetDistance = tp && sl ? Math.max(Math.abs(tp - entry), Math.abs(sl - entry)) : 1;
  const progress = Math.max(-100, Math.min(100, (movement / targetDistance) * 100));
  const favorable = movement >= 0;
  const stake = Number(trade.stake);
  const livePnl = calculateLivePnl(trade, currentPrice);
  const tpDistance = hasLevels ? Math.abs(tp - entry) : 0;
  const slDistance = hasLevels ? Math.abs(sl - entry) : 0;
  const tpHit = hasLevels && favorable && tpDistance > 0 && movement >= tpDistance;
  const slHit = hasLevels && !favorable && slDistance > 0 && Math.abs(movement) >= slDistance;

  return <li className="py-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-semibold">{trade.symbol} <span className={trade.direction === "up" ? "text-primary" : "text-destructive"}>{trade.direction === "up" ? "▲ Up" : "▼ Down"}</span></p>
        <p className="num text-xs text-muted-foreground">Entry ${formatPrice(entry)} | Live ${formatPrice(price)} | Stake {formatMoney(stake)} USD</p>
      </div>
      <div className="text-right"><Countdown expiresAt={trade.expires_at} /><p className={cn("num mt-1 text-xs font-semibold", favorable ? "text-primary" : "text-destructive")}>{favorable ? "+" : "minus "}{Math.abs(((price / entry) - 1) * 100).toFixed(3)}%</p></div>
    </div>
    <div className={cn("mt-3 flex items-center justify-between gap-3 rounded-md border p-3", favorable ? "border-primary/30 bg-primary/10" : "border-destructive/30 bg-destructive/10")}>
      <div>
        <p className="text-xs uppercase text-muted-foreground">Live PNL</p>
        <p className={cn("num text-xl font-semibold tabular-nums", favorable ? "text-primary" : "text-destructive")}>{livePnl >= 0 ? "+" : "minus "}{formatMoney(Math.abs(livePnl))} USD</p>
      </div>
      <p className="text-right text-xs text-muted-foreground">{tpHit ? "Take Profit level reached" : slHit ? "Stop Loss level reached" : "Moving with the live price"}<br />Settles at expiry</p>
    </div>
    <Button type="button" variant="destructive" className="mt-3 w-full" disabled={stopping} onClick={onStop}>
      {stopping ? "Stopping trade" : "Stop trade now"}
    </Button>
    {hasLevels ? <>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-primary/30 bg-primary/10 p-2"><span className="text-muted-foreground">Take Profit</span><p className="num mt-1 font-semibold text-primary">{trade.take_profit_percent}% | ${formatPrice(tp)}</p></div>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2"><span className="text-muted-foreground">Stop Loss</span><p className="num mt-1 font-semibold text-destructive">{trade.stop_loss_percent}% | ${formatPrice(sl)}</p></div>
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-secondary" aria-label={`Position progress ${Math.round(progress)} percent`}>
        <div className="absolute left-1/2 top-0 h-full w-px bg-foreground/40" />
        <div className={cn("absolute top-0 h-full transition-all", favorable ? "left-1/2 bg-primary" : "right-1/2 bg-destructive")} style={{ width: `${Math.abs(progress) / 2}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">TP and SL track the live price. This trade settles only at expiry.</p>
    </> : <p className="mt-2 text-xs text-muted-foreground">This earlier trade settles at expiry without TP or SL levels.</p>}
  </li>;
}

function signalFor(points: number[], change: number) {
  if (points.length < 6) return { direction: "wait" as const, confidence: 0, reason: "Waiting for enough market data" };
  const recent = points.slice(-6);
  const shortMove = ((recent.at(-1) ?? 0) / (recent[0] || 1) - 1) * 100;
  const agreement = Math.sign(shortMove) === Math.sign(change);
  const confidence = Math.min(88, Math.round(52 + Math.abs(shortMove) * 12 + (agreement ? 10 : 0)));
  if (confidence < 60 || Math.abs(shortMove) < 0.08) return { direction: "wait" as const, confidence, reason: "Momentum is not strong enough" };
  return {
    direction: shortMove > 0 ? "up" as const : "down" as const,
    confidence,
    reason: `${shortMove > 0 ? "Positive" : "Negative"} short term momentum ${agreement ? "agrees with" : "differs from"} the daily move`,
  };
}

function TradePage() {
  const { mode } = useAccountMode();
  const { symbol: initialSymbol } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: markets, dataUpdatedAt } = useMarkets();
  const { data: account } = useAccount();
  const submit = useServerFn(placeTrade);
  const stopTrade = useServerFn(stopDemoTrade);
  const [symbol, setSymbol] = useState(initialSymbol ?? "BTC");
  const [duration, setDuration] = useState(60);
  const [stake, setStake] = useState("50");
  const [takeProfit, setTakeProfit] = useState("2");
  const [stopLoss, setStopLoss] = useState("1");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoMinimum, setAutoMinimum] = useState("70");
  const [autoLimit, setAutoLimit] = useState("3");
  const [lossLimit, setLossLimit] = useState("150");
  const [autoPlaced, setAutoPlaced] = useState(0);
  const sessionBalance = useRef<number | null>(null);
  const lastAutoQuote = useRef<number | null>(null);

  const quotes = markets?.quotes ?? [];
  const quote = quotes.find((item) => item.symbol === symbol);
  const asset = ASSETS.find((item) => item.symbol === symbol);
  const balance = account?.profile ? Number(mode === "demo" ? account.profile.demo_balance : account.profile.live_balance) : 0;
  const stakeValue = Number(stake) || 0;
  const validStake = stakeValue >= 2 && stakeValue <= 500 && stakeValue <= balance;
  const takeProfitValue = Number(takeProfit) || 0;
  const stopLossValue = Number(stopLoss) || 0;
  const validLevels = takeProfitValue >= 0.1 && takeProfitValue <= 50 && stopLossValue >= 0.1 && stopLossValue <= 50;
  const payout = asset ? (stakeValue * asset.payoutRate) / 100 : 0;
  const openTrades = (account?.trades ?? []).filter((trade) => trade.status === "open" && trade.account_mode === mode);
  const signal = useMemo(() => signalFor(quote?.sparkline ?? [], quote?.change24h ?? 0), [quote]);
  const sessionLoss = sessionBalance.current === null ? 0 : Math.max(0, sessionBalance.current - balance);

  const mutation = useMutation({
    mutationFn: ({ direction, source, selectedSymbol = symbol, selectedStake = stakeValue, selectedDuration = duration }: { direction: Direction; source: TradeSource; selectedSymbol?: string; selectedStake?: number; selectedDuration?: number }) =>
      submit({ data: { accountMode: mode, symbol: selectedSymbol, direction, stake: selectedStake, durationSeconds: selectedDuration, source, takeProfitPercent: takeProfitValue, stopLossPercent: stopLossValue } }),
    onSuccess: (res, variables) => {
      toast.success(`${variables.source === "auto" ? "Automatic" : variables.source === "scanner" ? "Scanner Demo" : "Demo"} ${res.trade.direction === "up" ? "Up" : "Down"} trade opened on ${res.trade.symbol}.`);
      queryClient.invalidateQueries({ queryKey: ["account"] });
      if (variables.source === "auto") setAutoPlaced((value) => value + 1);
      if (variables.source === "assist") toast.info("Assisted trade added to History with its opening balance.");
      if (variables.source === "scanner") toast.info("Scanner Demo trades are configured to win at expiry for practice.");
    },
    onError: (error) => {
      setAutoEnabled(false);
      toast.error(error instanceof Error ? error.message : "Could not open the trade.");
    },
  });

  const stopMutation = useMutation({
    mutationFn: (tradeId: string) => stopTrade({ data: { tradeId } }),
    onSuccess: (res) => {
      toast.success(`Trade stopped at ${res.trade.pnl >= 0 ? "+" : "minus "}${formatMoney(Math.abs(Number(res.trade.pnl)))} USD PNL.`);
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not stop the Demo trade."),
  });

  useEffect(() => {
    if (mode !== "demo") setAutoEnabled(false);
  }, [mode]);

  useEffect(() => {
    if (!autoEnabled || !quote || signal.direction === "wait" || mutation.isPending || !validLevels) return;
    if (Date.now() - dataUpdatedAt > 45_000 || signal.confidence < Number(autoMinimum)) return;
    if (autoPlaced >= Number(autoLimit) || sessionLoss >= Number(lossLimit) || !validStake) {
      setAutoEnabled(false);
      toast.info("Demo auto trading stopped at your session limit.");
      return;
    }
    if (lastAutoQuote.current === dataUpdatedAt) return;
    lastAutoQuote.current = dataUpdatedAt;
    mutation.mutate({ direction: signal.direction, source: "auto" });
  }, [autoEnabled, autoLimit, autoMinimum, autoPlaced, dataUpdatedAt, lossLimit, mutation, quote, sessionLoss, signal, stakeValue, validLevels, validStake]);

  function toggleAuto(checked: boolean) {
    if (checked) {
      sessionBalance.current = balance;
      setAutoPlaced(0);
      lastAutoQuote.current = dataUpdatedAt;
    }
    setAutoEnabled(checked);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Trade</h1>
        <p className="text-sm text-muted-foreground">{mode === "demo" ? "Trade manually or use transparent Demo market assistance." : "Real trading stays locked until account and payment verification is complete."}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full border border-border bg-secondary"><AssetIcon symbol={symbol} /></div>
                <div><p className="font-display text-xl font-semibold">{quote?.symbol ?? symbol} / USD</p><p className="text-xs text-muted-foreground">{quote?.name ?? asset?.name}</p></div>
              </div>
              <div className="text-right">{quote ? <PriceText value={quote.price} /> : <span className="num">Unavailable</span>}<div className="mt-1">{quote ? <ChangeBadge value={quote.change24h} /> : null}</div></div>
            </div>
            <div className="mt-5 flex h-40 items-center justify-center border-y border-border/60 bg-secondary/15">{quote ? <Sparkline points={quote.sparkline} up={quote.change24h >= 0} /> : null}</div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase text-muted-foreground">Trade Assist</p><h2 className="mt-1 text-lg font-semibold">Market signal</h2></div>
              <div className={cn("rounded-md px-3 py-1 text-sm font-semibold", signal.direction === "up" ? "bg-primary/15 text-primary" : signal.direction === "down" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground")}>{signal.direction === "up" ? "Up" : signal.direction === "down" ? "Down" : "Wait"}</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Confidence</p><p className="num mt-1 font-semibold">{signal.confidence}%</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Reason</p><p className="mt-1 text-sm">{signal.reason}</p></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button variant="outline" disabled={mode === "live" || signal.direction === "wait" || mutation.isPending || !validStake || !validLevels} onClick={() => signal.direction !== "wait" && mutation.mutate({ direction: signal.direction, source: "assist" })}>
                <ChartNoAxesCombined className="size-4" /> Review and place
              </Button>
              <p className="text-xs text-muted-foreground">Uses recent price momentum for simulation. It is not financial advice.</p>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Demo auto trading</h2><p className="text-xs text-muted-foreground">Runs only while this page is open.</p></div><Switch checked={autoEnabled} onCheckedChange={toggleAuto} disabled={mode === "live"} aria-label="Demo auto trading" /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div><Label htmlFor="confidence">Minimum confidence</Label><Input id="confidence" className="mt-1" inputMode="numeric" value={autoMinimum} onChange={(event) => setAutoMinimum(event.target.value)} /></div>
              <div><Label htmlFor="tradeLimit">Maximum trades</Label><Input id="tradeLimit" className="mt-1" inputMode="numeric" value={autoLimit} onChange={(event) => setAutoLimit(event.target.value)} /></div>
              <div><Label htmlFor="lossLimit">Maximum session loss</Label><Input id="lossLimit" className="mt-1" inputMode="decimal" value={lossLimit} onChange={(event) => setLossLimit(event.target.value)} /></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{autoEnabled ? `${autoPlaced} of ${Number(autoLimit) || 0} trades placed. Session loss ${formatMoney(sessionLoss)} USD.` : "Off. Real accounts can never use automatic trading."}</p>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Open positions</h2>
            {openTrades.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nothing open right now.</p> : <ul className="mt-3 divide-y divide-border/60">{openTrades.map((trade) => <ActivePosition key={trade.id} trade={trade} currentPrice={quotes.find((item) => item.symbol === trade.symbol)?.price} stopping={stopMutation.isPending && stopMutation.variables === trade.id} onStop={() => stopMutation.mutate(trade.id)} />)}</ul>}
          </section>
        </div>

        <aside className="space-y-4 rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div><Label>Asset</Label><div className="mt-2 grid grid-cols-3 gap-2">{ASSETS.map((item) => <Button key={item.symbol} type="button" variant={symbol === item.symbol ? "default" : "outline"} onClick={() => setSymbol(item.symbol)} className="px-2"><AssetIcon symbol={item.symbol} className="size-4" />{item.symbol}</Button>)}</div></div>
          <div><Label>Expiry</Label><div className="mt-2 grid grid-cols-4 gap-2">{DURATIONS.map((item) => <Button key={item.seconds} type="button" variant={duration === item.seconds ? "default" : "outline"} onClick={() => setDuration(item.seconds)} className="px-2">{item.label}</Button>)}</div></div>
          <div><Label htmlFor="stake">Stake ({mode === "demo" ? "Demo USD" : "USDT"})</Label><Input id="stake" className="mt-2" type="number" inputMode="decimal" min="2" max="500" step="1" value={stake} onChange={(event) => setStake(event.target.value)} /><div className="mt-2 flex flex-wrap gap-2">{[25, 50, 100, 250].map((value) => <Button key={value} type="button" size="sm" variant="secondary" onClick={() => setStake(String(value))}>{value}</Button>)}</div><p className="mt-2 text-xs text-muted-foreground">Minimum 2 USD | Maximum 500 USD</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="takeProfit">Take Profit %</Label><Input id="takeProfit" className="mt-2" type="number" inputMode="decimal" min="0.1" max="50" step="0.1" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} /></div>
            <div><Label htmlFor="stopLoss">Stop Loss %</Label><Input id="stopLoss" className="mt-2" type="number" inputMode="decimal" min="0.1" max="50" step="0.1" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} /></div>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><Target className="mt-0.5 size-4 shrink-0" />Levels must be between 0.1% and 50%. They guide the active trade and do not close it early.</p>
          <dl className="space-y-2 border-y border-border py-4 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Payout rate</dt><dd className="num font-semibold text-primary">{asset?.payoutRate ?? 0}%</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Profit if correct</dt><dd className="num font-semibold text-primary">+{formatMoney(payout)} {mode === "demo" ? "USD" : "USDT"}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Available</dt><dd className="num font-semibold">{formatMoney(balance)} {mode === "demo" ? "USD" : "USDT"}</dd></div></dl>
          <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Trade now</p><div className="grid grid-cols-2 gap-2"><Button className="h-12 text-base" disabled={mode === "live" || mutation.isPending || !validStake || !validLevels} onClick={() => mutation.mutate({ direction: "up", source: "manual" })}><ArrowUpRight className="size-5" /> Up</Button><Button variant="destructive" className="h-12 text-base" disabled={mode === "live" || mutation.isPending || !validStake || !validLevels} onClick={() => mutation.mutate({ direction: "down", source: "manual" })}><ArrowDownRight className="size-5" /> Down</Button></div></div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" />{mode === "demo" ? "Every trade uses simulated money and appears in History with its balance result." : "Real trading unlocks only after a regulated provider is connected."}</p>
        </aside>
      </div>
      <MarketScanner
        mode={mode}
        balance={balance}
        busy={mutation.isPending}
        onExecute={(setup) => {
          setSymbol(setup.symbol);
          setDuration(setup.durationSeconds);
          setStake(String(setup.stake));
          mutation.mutate({
            direction: setup.direction,
            source: "scanner",
            selectedSymbol: setup.symbol,
            selectedStake: setup.stake,
            selectedDuration: setup.durationSeconds,
          });
        }}
      />
    </div>
  );
}