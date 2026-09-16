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
import { CandlestickChart } from "@/components/candlestick-chart";
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
type CandleInterval = "1" | "5" | "15" | "60";
const CANDLE_INTERVALS: { value: CandleInterval; label: string }[] = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1h" },
];

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

function PanelTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</span>
      {right}
    </div>
  );
}

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

  return (
    <li className="rounded-md border border-border/70 bg-secondary/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full border border-border bg-card"><AssetIcon symbol={trade.symbol} className="size-3.5" /></span>
          <span className="text-sm font-semibold">{trade.symbol} / USD</span>
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", trade.direction === "up" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>{trade.direction === "up" ? "Up" : "Down"}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Countdown expiresAt={trade.expires_at} />
          <span className="num">Stake {formatMoney(stake)}</span>
        </div>
      </div>

      <div className={cn("mt-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2", favorable ? "border-primary/30 bg-primary/10" : "border-destructive/30 bg-destructive/10")}>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Live PNL</p>
          <p className={cn("num text-lg font-semibold tabular-nums", favorable ? "text-primary" : "text-destructive")}>{livePnl >= 0 ? "+" : "minus "}{formatMoney(Math.abs(livePnl))} USD</p>
        </div>
        <p className="num text-right text-[11px] text-muted-foreground">Entry ${formatPrice(entry)}<br />Live ${formatPrice(price)}</p>
      </div>

      {hasLevels ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5"><span className="text-muted-foreground">Take Profit</span><p className="num font-semibold text-primary">{trade.take_profit_percent}% | ${formatPrice(tp)}</p></div>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5"><span className="text-muted-foreground">Stop Loss</span><p className="num font-semibold text-destructive">{trade.stop_loss_percent}% | ${formatPrice(sl)}</p></div>
          </div>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-label={`Position progress ${Math.round(progress)} percent`}>
            <div className="absolute left-1/2 top-0 h-full w-px bg-foreground/40" />
            <div className={cn("absolute top-0 h-full transition-all", favorable ? "left-1/2 bg-primary" : "right-1/2 bg-destructive")} style={{ width: `${Math.abs(progress) / 2}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{tpHit ? "Closing at Take Profit" : slHit ? "Closing at Stop Loss" : "TP and SL track the live price and close the trade when reached."}</p>
        </>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">This earlier trade can be stopped now or settled at expiry.</p>
      )}

      <Button type="button" variant="destructive" size="sm" className="mt-2 w-full" disabled={stopping} onClick={onStop}>
        {stopping ? "Stopping trade" : "Stop trade now"}
      </Button>
    </li>
  );
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
  const [candleInterval, setCandleInterval] = useState<CandleInterval>("1");
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
  const unit = mode === "demo" ? "USD" : "USDT";
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
  const sparkline = quote?.sparkline ?? [];
  const sessionHigh = sparkline.length > 0 ? Math.max(...sparkline) : null;
  const sessionLow = sparkline.length > 0 ? Math.min(...sparkline) : null;
  const sessionOpen = sparkline.length > 0 ? sparkline[0] : null;
  const locked = mode === "live";

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
      if (!res.trade) {
        toast.info("That trade had already closed at its take profit, stop loss, or expiry.");
      } else {
        const pnl = Number(res.trade.pnl);
        toast.success(`Trade stopped at ${pnl >= 0 ? "+" : "minus "}${formatMoney(Math.abs(pnl))} USD PNL.`);
      }
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not stop the Demo trade."),
  });

  const disabled = locked || mutation.isPending || !validStake || !validLevels;

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
    <div className="space-y-2">
      {/* Market strip */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full border border-border bg-secondary"><AssetIcon symbol={symbol} className="size-4" /></span>
          <div>
            <p className="text-sm font-semibold leading-tight">{symbol} / USD</p>
            <p className="text-[11px] text-muted-foreground">{quote?.name ?? asset?.name}</p>
          </div>
          <div className="flex items-baseline gap-2 border-l border-border pl-3">
            <span className={cn("num text-base font-semibold", (quote?.change24h ?? 0) >= 0 ? "text-primary" : "text-destructive")}>{quote ? formatPrice(quote.price) : "Unavailable"}</span>
            {quote ? <span className={cn("num text-[11px]", quote.change24h >= 0 ? "text-primary" : "text-destructive")}>{quote.change24h >= 0 ? "+" : "minus "}{Math.abs(quote.change24h).toFixed(2)}%</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{mode === "demo" ? "Demo balance" : "Real balance"}</p>
            <p className="num text-sm font-semibold">{formatMoney(balance)} {unit}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-2 lg:grid-cols-12">
        {/* Market list */}
        <section className="order-3 flex flex-col rounded-lg border border-border bg-card lg:order-1 lg:col-span-3">
          <PanelTitle right={<span className="text-[10px] text-muted-foreground">{quotes.length || ASSETS.length} markets</span>}>Market assets</PanelTitle>
          <ul className="max-h-[320px] overflow-y-auto lg:max-h-[560px]">
            {ASSETS.map((item) => {
              const row = quotes.find((entry) => entry.symbol === item.symbol);
              const active = item.symbol === symbol;
              return (
                <li key={item.symbol}>
                  <button
                    type="button"
                    onClick={() => setSymbol(item.symbol)}
                    className={cn("flex w-full items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5 text-left transition-colors", active ? "border-l-2 border-l-primary bg-primary/10" : "hover:bg-secondary/40")}
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full border border-border bg-secondary"><AssetIcon symbol={item.symbol} className="size-3" /></span>
                      <span className="text-[11px] font-semibold">{item.name}</span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-[11px] font-semibold">{row ? formatPrice(row.price) : "Unavailable"}</span>
                      {row ? <span className={cn("num block text-[10px]", row.change24h >= 0 ? "text-primary" : "text-destructive")}>{row.change24h >= 0 ? "+" : "minus "}{Math.abs(row.change24h).toFixed(1)}%</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Chart, signal, positions */}
        <div className="order-1 flex flex-col gap-2 lg:col-span-6">
          <section className="flex flex-col rounded-lg border border-border bg-card">
            <PanelTitle right={
              <span className="num flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span>O {sessionOpen ? formatPrice(sessionOpen) : "Unavailable"}</span>
                <span>H {sessionHigh ? formatPrice(sessionHigh) : "Unavailable"}</span>
                <span>L {sessionLow ? formatPrice(sessionLow) : "Unavailable"}</span>
              </span>
            }>Live candles</PanelTitle>
            <div className="flex items-center gap-1 border-b border-border px-2 py-1">
              {CANDLE_INTERVALS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCandleInterval(item.value)}
                  className={cn(
                    "rounded-sm px-2 py-0.5 text-[10px] font-semibold",
                    candleInterval === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="h-64 px-1 pb-1 lg:h-80">
              <CandlestickChart symbol={symbol} interval={candleInterval} className="h-full w-full" />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <PanelTitle right={
              <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase", signal.direction === "up" ? "bg-primary/15 text-primary" : signal.direction === "down" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground")}>
                {signal.direction === "up" ? "Up signal" : signal.direction === "down" ? "Down signal" : "Wait"}
              </span>
            }>Trade assist</PanelTitle>
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
              <div className="min-w-[180px] flex-1">
                <p className="text-xs text-muted-foreground">{signal.reason}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 w-28 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${signal.confidence}%` }} /></div>
                  <span className="num text-[11px] font-semibold">{signal.confidence}% confidence</span>
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={signal.direction === "wait" || disabled} onClick={() => signal.direction !== "wait" && mutation.mutate({ direction: signal.direction, source: "assist" })}>
                <ChartNoAxesCombined className="size-4" /> Review and place
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <PanelTitle right={<span className="num text-[10px] text-muted-foreground">{openTrades.length} running</span>}>Open trades</PanelTitle>
            {openTrades.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">Nothing open right now. Place a trade from the order pad.</p>
            ) : (
              <ul className="max-h-[360px] space-y-2 overflow-y-auto p-3">
                {openTrades.map((trade) => (
                  <ActivePosition
                    key={trade.id}
                    trade={trade}
                    currentPrice={quotes.find((item) => item.symbol === trade.symbol)?.price}
                    stopping={stopMutation.isPending && stopMutation.variables === trade.id}
                    onStop={() => stopMutation.mutate(trade.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Order pad */}
        <aside className="order-2 flex flex-col rounded-lg border border-border bg-card lg:order-3 lg:col-span-3">
          <PanelTitle right={locked ? <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Locked</span> : null}>Order pad</PanelTitle>
          <div className="space-y-4 p-3">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Expiry time</Label>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {DURATIONS.map((item) => (
                  <Button key={item.seconds} type="button" size="sm" variant={duration === item.seconds ? "default" : "secondary"} onClick={() => setDuration(item.seconds)}>{item.label}</Button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="stake" className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount ({unit})</Label>
                <span className="num text-[10px] text-muted-foreground">Min 2 | Max 500</span>
              </div>
              <Input id="stake" className="num mt-2 h-11 text-base font-semibold" type="number" inputMode="decimal" min="2" max="500" step="1" value={stake} onChange={(event) => setStake(event.target.value)} />
              <div className="mt-1.5 grid grid-cols-5 gap-1">
                {[10, 50, 100, 250, 500].map((value) => (
                  <Button key={value} type="button" size="sm" variant="secondary" className="h-7 px-0 text-[10px]" onClick={() => setStake(String(value))}>{value}</Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="takeProfit" className="text-[10px] uppercase tracking-widest text-muted-foreground">Take profit %</Label>
                <Input id="takeProfit" className="num mt-1.5 h-9" type="number" inputMode="decimal" min="0.1" max="50" step="0.1" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="stopLoss" className="text-[10px] uppercase tracking-widest text-muted-foreground">Stop loss %</Label>
                <Input id="stopLoss" className="num mt-1.5 h-9" type="number" inputMode="decimal" min="0.1" max="50" step="0.1" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} />
              </div>
            </div>
            <p className="flex items-start gap-2 text-[11px] text-muted-foreground"><Target className="mt-0.5 size-3.5 shrink-0" />Levels stay between 0.1% and 50%. Reaching either level closes the Demo trade.</p>

            <dl className="space-y-1.5 rounded-md border border-border/70 bg-secondary/20 px-3 py-2.5 text-xs">
              <div className="flex justify-between"><dt className="text-muted-foreground">Return rate</dt><dd className="num font-semibold text-primary">{asset?.payoutRate ?? 0}%</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Expected profit</dt><dd className="num font-semibold text-primary">+{formatMoney(payout)} {unit}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Available</dt><dd className="num font-semibold">{formatMoney(balance)} {unit}</dd></div>
            </dl>

            <div className="grid gap-2">
              <Button className="h-14 flex-col gap-0.5" disabled={disabled} onClick={() => mutation.mutate({ direction: "up", source: "manual" })}>
                <span className="flex items-center gap-1 text-base font-semibold"><ArrowUpRight className="size-5" /> Up</span>
                <span className="num text-[10px] opacity-80">Above {quote ? formatPrice(quote.price) : "market"}</span>
              </Button>
              <Button variant="destructive" className="h-14 flex-col gap-0.5" disabled={disabled} onClick={() => mutation.mutate({ direction: "down", source: "manual" })}>
                <span className="flex items-center gap-1 text-base font-semibold"><ArrowDownRight className="size-5" /> Down</span>
                <span className="num text-[10px] opacity-80">Below {quote ? formatPrice(quote.price) : "market"}</span>
              </Button>
            </div>

            <div className="space-y-3 border-t border-border/70 pt-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Demo auto trading</p>
                  <p className="text-[11px] text-muted-foreground">Runs only while this page is open.</p>
                </div>
                <Switch checked={autoEnabled} onCheckedChange={toggleAuto} disabled={locked} aria-label="Demo auto trading" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div><Label htmlFor="confidence" className="text-[10px] text-muted-foreground">Min conf.</Label><Input id="confidence" className="num mt-1 h-8 px-2 text-xs" inputMode="numeric" value={autoMinimum} onChange={(event) => setAutoMinimum(event.target.value)} /></div>
                <div><Label htmlFor="tradeLimit" className="text-[10px] text-muted-foreground">Max trades</Label><Input id="tradeLimit" className="num mt-1 h-8 px-2 text-xs" inputMode="numeric" value={autoLimit} onChange={(event) => setAutoLimit(event.target.value)} /></div>
                <div><Label htmlFor="lossLimit" className="text-[10px] text-muted-foreground">Max loss</Label><Input id="lossLimit" className="num mt-1 h-8 px-2 text-xs" inputMode="decimal" value={lossLimit} onChange={(event) => setLossLimit(event.target.value)} /></div>
              </div>
              <p className="text-[11px] text-muted-foreground">{autoEnabled ? `${autoPlaced} of ${Number(autoLimit) || 0} trades placed. Session loss ${formatMoney(sessionLoss)} USD.` : "Off. Real accounts can never use automatic trading."}</p>
            </div>

            <p className="flex items-start gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />{mode === "demo" ? "Every trade uses simulated money and appears in History with its balance result." : "Real trading unlocks only after a regulated provider is connected."}</p>
          </div>
        </aside>
      </div>

      <p className="rounded-lg border border-dashed border-border bg-card/40 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Simulation mode | No real funds involved | Virtual balance for practice only
      </p>

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
