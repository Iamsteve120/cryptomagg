import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Bot, ChartNoAxesCombined, Play, ShieldCheck, Square, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetIcon } from "@/components/ui/asset-icon";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CandlestickChart } from "@/components/candlestick-chart";
import { useAccount, useMarkets } from "@/hooks/use-trading";
import { placeTrade, stopDemoTrade } from "@/lib/trading.functions";
import { TRADABLE_ASSETS, DURATIONS, MULTIPLIERS, TRADING_BOTS, formatMoney, formatPrice } from "@/lib/assets";
import { calculateLivePnl } from "@/lib/trade-pnl";
import { cn } from "@/lib/utils";
import { useAccountMode } from "@/components/account-mode";
import { MarketScanner } from "@/components/market-scanner";
import { useThemeMode } from "@/components/theme-mode";

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
          <p className={cn("num text-lg font-semibold tabular-nums", favorable ? "text-primary" : "text-destructive")}>{livePnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(livePnl))} USD</p>
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

      {trade.trade_source === "auto" ? <p className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-center text-[11px] text-muted-foreground">Bot trade closes only at Take Profit, Stop Loss, or when time expires.</p> : <Button type="button" variant="destructive" size="sm" className="mt-2 w-full" disabled={stopping} onClick={onStop}>{stopping ? "Stopping trade" : "Stop trade now"}</Button>}
    </li>
  );
}

function signalFor(points: number[], change: number) {
  if (points.length < 6) return { direction: "wait" as const, confidence: 0, reason: "Waiting for enough market data" };
  const recent = points.slice(-6);
  const shortMove = ((recent.at(-1) ?? 0) / (recent[0] || 1) - 1) * 100;
  const agreement = Math.sign(shortMove) === Math.sign(change);
  const confidence = Math.min(87, 80 + Math.round(Math.min(5, Math.abs(shortMove) * 8)) + (agreement ? 2 : 0));
  if (Math.abs(shortMove) < 0.02) return { direction: "wait" as const, confidence: 80, reason: "Waiting for clearer momentum" };
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
  const { theme } = useThemeMode();
  const [stake, setStake] = useState("50");
  const [tradeMode, setTradeMode] = useState<"manual" | "auto">("manual");
  const [multiplier, setMultiplier] = useState(1);
  const [botId, setBotId] = useState("momentum");
  const [takeProfit, setTakeProfit] = useState("2");
  const [stopLoss, setStopLoss] = useState("1");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoMinimum, setAutoMinimum] = useState("80");
  const [autoLimit, setAutoLimit] = useState("3");
  const [lossLimit, setLossLimit] = useState("150");
  const [autoPlaced, setAutoPlaced] = useState(0);
  const [botSetupOpen, setBotSetupOpen] = useState(false);
  const [pendingBotId, setPendingBotId] = useState("momentum");
  const [botDuration, setBotDuration] = useState("60");
  const [botTradeCount, setBotTradeCount] = useState("5");
  const [botTakeProfit, setBotTakeProfit] = useState("2");
  const [botStopLoss, setBotStopLoss] = useState("1");
  const botTakeProfitRef = useRef(2);
  const botStopLossRef = useRef(1);
  const sessionStartedAt = useRef<number | null>(null);
  const lastAutoQuote = useRef<number | null>(null);

  const quotes = markets?.quotes ?? [];
  const quote = quotes.find((item) => item.symbol === symbol);
  const asset = TRADABLE_ASSETS.find((item) => item.symbol === symbol);
  const unit = mode === "demo" ? "USD" : "USDT";
  const balance = account?.profile ? Number(mode === "demo" ? account.profile.demo_balance : account.profile.live_balance) : 0;
  const stakeValue = Number(stake) || 0;
  const validStake = stakeValue >= 2 && stakeValue <= 500 && stakeValue <= balance;
  const takeProfitValue = Number(takeProfit) || 0;
  const stopLossValue = Number(stopLoss) || 0;
  const validLevels = takeProfitValue >= 0.1 && takeProfitValue <= 50 && stopLossValue >= 0.1 && stopLossValue <= 50;
  const effectiveTakeProfit = Math.max(0.1, Math.round((takeProfitValue / multiplier) * 100) / 100);
  const effectiveStopLoss = Math.max(0.1, Math.round((stopLossValue / multiplier) * 100) / 100);
  const selectedBot = TRADING_BOTS.find((bot) => bot.id === botId);
  const payout = asset ? (stakeValue * asset.payoutRate) / 100 : 0;
  const openTrades = (account?.trades ?? []).filter((trade) => trade.status === "open" && trade.account_mode === mode);
  const signal = useMemo(() => signalFor(quote?.sparkline ?? [], quote?.change24h ?? 0), [quote]);
  const openAutoSymbols = useMemo(() => new Set(openTrades.filter((trade) => trade.trade_source === "auto").map((trade) => trade.symbol)), [openTrades]);
  const autoCandidate = useMemo(() => quotes
    .map((item) => ({ quote: item, signal: signalFor(item.sparkline, item.change24h) }))
    .filter((item) => !openAutoSymbols.has(item.quote.symbol) && item.signal.direction !== "wait" && item.signal.confidence >= Number(autoMinimum))
    .sort((a, b) => b.signal.confidence - a.signal.confidence)[0], [autoMinimum, openAutoSymbols, quotes]);
  const sessionLoss = (account?.trades ?? [])
    .filter((trade) => trade.trade_source === "auto" && trade.status !== "open" && sessionStartedAt.current !== null && new Date(trade.created_at).getTime() >= sessionStartedAt.current)
    .reduce((total, trade) => total + Math.max(0, 0 - Number(trade.pnl ?? 0)), 0);
  const sparkline = quote?.sparkline ?? [];
  const sessionHigh = sparkline.length > 0 ? Math.max(...sparkline) : null;
  const sessionLow = sparkline.length > 0 ? Math.min(...sparkline) : null;
  const sessionOpen = sparkline.length > 0 ? sparkline[0] : null;
  const locked = mode === "live";

  const mutation = useMutation({
    mutationFn: ({ direction, source, selectedSymbol = symbol, selectedStake = stakeValue, selectedDuration = duration }: { direction: Direction; source: TradeSource; selectedSymbol?: string; selectedStake?: number; selectedDuration?: number }) =>
      submit({ data: { accountMode: mode, symbol: selectedSymbol, direction, stake: selectedStake, durationSeconds: selectedDuration, source, takeProfitPercent: source === "auto" ? botTakeProfitRef.current : effectiveTakeProfit, stopLossPercent: source === "auto" ? botStopLossRef.current : effectiveStopLoss } }),
    onSuccess: (res, variables) => {
      toast.success(`${variables.source === "auto" ? "Automatic" : variables.source === "scanner" ? "Scanner Demo" : "Demo"} ${res.trade.direction === "up" ? "Up" : "Down"} trade opened on ${res.trade.symbol}.`);
      queryClient.invalidateQueries({ queryKey: ["account"] });
      if (variables.source === "auto") setAutoPlaced((value) => value + 1);
      if (variables.source === "assist") toast.info("Assisted trade added to History with its opening balance.");
      if (variables.source === "scanner") toast.info("Scanner Demo outcomes follow the simulator's win and loss mix.");
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
        toast.success(`Trade stopped at ${pnl >= 0 ? "+" : "-"}${formatMoney(Math.abs(pnl))} USD PNL.`);
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
    if (!autoEnabled || !autoCandidate || mutation.isPending || !validLevels) return;
    if (Date.now() - dataUpdatedAt > 30_000) return;
    if (autoPlaced >= Math.min(40, Math.max(5, Number(autoLimit) || 5)) || sessionLoss >= Math.max(0, Number(lossLimit) || 0) || !validStake) {
      setAutoEnabled(false);
      toast.info("Demo auto trading stopped at your session limit.");
      return;
    }
    if (lastAutoQuote.current === dataUpdatedAt) return;
    lastAutoQuote.current = dataUpdatedAt;
    const autoDirection = autoCandidate.signal.direction;
    if (autoDirection === "wait") return;
    setSymbol(autoCandidate.quote.symbol);
    mutation.mutate({ direction: autoDirection, source: "auto", selectedSymbol: autoCandidate.quote.symbol });
  }, [autoCandidate, autoEnabled, autoLimit, autoPlaced, dataUpdatedAt, lossLimit, mutation, openTrades, sessionLoss, validLevels, validStake]);

  function openBotSetup(bot = selectedBot) {
    if (!bot) return;
    setPendingBotId(bot.id);
    setBotDuration(String(Math.min(3600, Math.max(30, bot.durationSeconds))));
    setBotTradeCount(String(Math.min(40, Math.max(5, bot.tradeLimit))));
    setBotTakeProfit(takeProfit);
    setBotStopLoss(stopLoss);
    setBotSetupOpen(true);
  }

  function startAutoTrading() {
    if (mode !== "demo" || !validStake || !validLevels) return;
    const bot = TRADING_BOTS.find((item) => item.id === pendingBotId) ?? selectedBot;
    const configuredDuration = Math.min(3600, Math.max(30, Number(botDuration) || 30));
    const configuredTradeCount = Math.min(40, Math.max(5, Number(botTradeCount) || 5));
    const configuredTakeProfit = Math.min(50, Math.max(0.1, Number(botTakeProfit) || 0.1));
    const configuredStopLoss = Math.min(50, Math.max(0.1, Number(botStopLoss) || 0.1));
    if (bot) {
      setBotId(bot.id);
      setDuration(configuredDuration);
      setMultiplier(bot.multiplier);
      setAutoMinimum(String(bot.minConfidence));
      setAutoLimit(String(configuredTradeCount));
    }
    sessionStartedAt.current = Date.now();
    botTakeProfitRef.current = configuredTakeProfit;
    botStopLossRef.current = configuredStopLoss;
    setAutoPlaced(0);
    lastAutoQuote.current = null;
    setAutoEnabled(true);
    setBotSetupOpen(false);
    toast.success(`${bot?.name ?? "Trading bot"} started. It will run several trades across the strongest markets.`);
  }

  function stopAutoTrading() {
    setAutoEnabled(false);
    toast.info("AI trading stopped. Open trades continue until closed or expired.");
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
            {quote ? <span className={cn("num text-[11px]", quote.change24h >= 0 ? "text-primary" : "text-destructive")}>{quote.change24h >= 0 ? "+" : "-"}{Math.abs(quote.change24h).toFixed(2)}%</span> : null}
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
          <PanelTitle right={<span className="text-[10px] text-muted-foreground">{quotes.length || TRADABLE_ASSETS.length} markets</span>}>Market assets</PanelTitle>
          <ul className="max-h-[320px] overflow-y-auto lg:max-h-[560px]">
            {TRADABLE_ASSETS.map((item) => {
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
                      {row ? <span className={cn("num block text-[10px]", row.change24h >= 0 ? "text-primary" : "text-destructive")}>{row.change24h >= 0 ? "+" : "-"}{Math.abs(row.change24h).toFixed(1)}%</span> : null}
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
              <CandlestickChart symbol={symbol} interval={candleInterval} theme={theme} className="h-full w-full" />
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
          <PanelTitle right={locked ? <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Demo only</span> : null}>Order pad</PanelTitle>

          <div className="grid grid-cols-2 gap-1 border-b border-border/70 p-2">
            <Button type="button" size="sm" variant={tradeMode === "manual" ? "default" : "secondary"} onClick={() => setTradeMode("manual")}>
              <ChartNoAxesCombined className="size-4" /> Manual
            </Button>
            <Button type="button" size="sm" variant={tradeMode === "auto" ? "default" : "secondary"} onClick={() => setTradeMode("auto")}>
              <Bot className="size-4" /> Auto
            </Button>
          </div>

          <div className="space-y-4 p-3">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Trade time</Label>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {DURATIONS.map((item) => (
                  <Button key={item.seconds} type="button" size="sm" variant={duration === item.seconds ? "default" : "secondary"} className="h-8 px-0 text-[11px]" onClick={() => setDuration(item.seconds)}>{item.label}</Button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Multiplier</Label>
                <span className="num text-[10px] text-muted-foreground">x{multiplier}</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {MULTIPLIERS.map((value) => (
                  <Button key={value} type="button" size="sm" variant={multiplier === value ? "default" : "secondary"} className="h-8 px-0 text-[11px]" onClick={() => setMultiplier(value)}>x{value}</Button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">A higher multiplier reaches your target on a smaller price move.</p>
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
            <p className="flex items-start gap-2 text-[11px] text-muted-foreground"><Target className="mt-0.5 size-3.5 shrink-0" />With x{multiplier} your trade closes at a {effectiveTakeProfit}% gain or {effectiveStopLoss}% loss in price.</p>

            <dl className="space-y-1.5 rounded-md border border-border/70 bg-secondary/20 px-3 py-2.5 text-xs">
              <div className="flex justify-between"><dt className="text-muted-foreground">Return rate</dt><dd className="num font-semibold text-primary">{asset?.payoutRate ?? 0}%</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Expected profit</dt><dd className="num font-semibold text-primary">+{formatMoney(payout)} {unit}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Available</dt><dd className="num font-semibold">{formatMoney(balance)} {unit}</dd></div>
            </dl>

            {tradeMode === "manual" ? (
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
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Bot className="size-4" /></span>
                    <div>
                      <p className="text-xs font-semibold">Trading bots</p>
                      <p className="text-[11px] text-muted-foreground">Pick a bot, then start. It scans every market for you.</p>
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase", autoEnabled ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                    {autoEnabled ? "Running" : "Stopped"}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {TRADING_BOTS.map((bot) => (
                    <li key={bot.id}>
                      <button
                        type="button"
                        onClick={() => openBotSetup(bot)}
                        disabled={locked || mutation.isPending || !validStake || !validLevels}
                        className={cn("w-full rounded-md border px-2.5 py-2 text-left transition-colors", botId === bot.id ? "border-primary bg-primary/10" : "border-border/70 hover:bg-secondary/40")}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{bot.name}</span>
                          <span className="num text-[10px] text-muted-foreground">{bot.tradeLimit} trades | x{bot.multiplier} | {bot.durationSeconds < 60 ? `${bot.durationSeconds}s` : `${bot.durationSeconds / 60}m`}</span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{bot.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="grid grid-cols-3 gap-1.5">
                  <div><Label htmlFor="confidence" className="text-[10px] text-muted-foreground">Min conf.</Label><Input id="confidence" className="num mt-1 h-8 px-2 text-xs" type="number" min="80" max="87" inputMode="numeric" value={autoMinimum} onChange={(event) => setAutoMinimum(event.target.value)} /></div>
                  <div><Label htmlFor="tradeLimit" className="text-[10px] text-muted-foreground">Max trades</Label><Input id="tradeLimit" className="num mt-1 h-8 px-2 text-xs" type="number" min="5" max="40" inputMode="numeric" value={autoLimit} onChange={(event) => setAutoLimit(event.target.value)} /></div>
                  <div><Label htmlFor="lossLimit" className="text-[10px] text-muted-foreground">Max loss</Label><Input id="lossLimit" className="num mt-1 h-8 px-2 text-xs" type="number" min="0" max="500" inputMode="decimal" value={lossLimit} onChange={(event) => setLossLimit(event.target.value)} /></div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-10" onClick={() => openBotSetup()} disabled={locked || autoEnabled || mutation.isPending || !validStake || !validLevels}>
                    <Play className="size-4" /> Start trading
                  </Button>
                  <Button variant="destructive" className="h-10" onClick={stopAutoTrading} disabled={!autoEnabled}>
                    <Square className="size-4" /> Stop trading
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">{autoEnabled ? `${selectedBot?.name ?? "Bot"} running. ${autoPlaced} of ${Number(autoLimit) || 0} trades placed across different markets. Session loss ${formatMoney(sessionLoss)} USD.` : "Tap a bot to start its trade sequence. Demo outcomes vary within a 60 to 80 percent practice win range."}</p>
              </div>
            )}

            <p className="flex items-start gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />{mode === "demo" ? "Every trade uses simulated money and appears in History with its balance result." : "Trading tools are available in Demo mode."}</p>
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

      <Dialog open={botSetupOpen} onOpenChange={setBotSetupOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-lg bg-card p-0">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>Set up trading bot</DialogTitle>
            <DialogDescription>The bot automatically chooses the strongest crypto markets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5 py-4">
            <div>
              <Label htmlFor="botDuration">How long should each trade run?</Label>
              <select id="botDuration" value={botDuration} onChange={(event) => setBotDuration(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                {DURATIONS.filter((item) => item.seconds <= 3600).map((item) => <option key={item.seconds} value={item.seconds}>{item.label}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">Minimum 30 seconds | Maximum 1 hour</p>
            </div>
            <div>
              <Label htmlFor="botTradeCount">How many trades should the bot run?</Label>
              <Input id="botTradeCount" className="num mt-2 h-11" type="number" inputMode="numeric" min="5" max="40" step="1" value={botTradeCount} onChange={(event) => setBotTradeCount(event.target.value)} />
              <p className="mt-1.5 text-xs text-muted-foreground">Minimum 5 trades | Maximum 40 trades</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="botTakeProfit">Take Profit %</Label><Input id="botTakeProfit" className="num mt-2 h-11" type="number" inputMode="decimal" min="0.1" max="50" step="0.1" value={botTakeProfit} onChange={(event) => setBotTakeProfit(event.target.value)} /></div>
              <div><Label htmlFor="botStopLoss">Stop Loss %</Label><Input id="botStopLoss" className="num mt-2 h-11" type="number" inputMode="decimal" min="0.1" max="50" step="0.1" value={botStopLoss} onChange={(event) => setBotStopLoss(event.target.value)} /></div>
            </div>
            <div className="rounded-md border border-primary/25 bg-primary/10 p-3 text-sm">
              <p className="font-semibold">Automatic market selection</p>
              <p className="mt-1 text-xs text-muted-foreground">The bot scans all available assets and picks a different eligible market for each open trade.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border px-5 py-4 sm:space-x-0">
            <Button type="button" variant="secondary" onClick={() => setBotSetupOpen(false)}>Cancel</Button>
            <Button type="button" onClick={startAutoTrading} disabled={Number(botTradeCount) < 5 || Number(botTradeCount) > 40 || Number(botDuration) < 30 || Number(botDuration) > 3600 || Number(botTakeProfit) < 0.1 || Number(botTakeProfit) > 50 || Number(botStopLoss) < 0.1 || Number(botStopLoss) > 50}>
              <Play className="size-4" /> Start bot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
