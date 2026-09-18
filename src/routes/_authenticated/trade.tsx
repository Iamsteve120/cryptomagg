import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Bot, ChartNoAxesCombined, Play, RotateCcw, ShieldCheck, Square, Target, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetIcon } from "@/components/ui/asset-icon";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { CandlestickChart } from "@/components/candlestick-chart";
import { useAccount, useMarkets, useRapidMarketClock } from "@/hooks/use-trading";
import { placeTrade, stopAllDemoTrades, stopDemoTrade } from "@/lib/trading.functions";
import { getLiveAccountStatus } from "@/lib/payments.functions";
import { LIVE_PAYOUT_RATE } from "@/lib/live-trading";
import { SYNTHETIC_INSTRUMENTS, isSyntheticSymbol } from "@/lib/synthetic";
import { SyntheticChart } from "@/components/synthetic-chart";
import { TRADABLE_ASSETS, DURATIONS, MULTIPLIERS, TRADING_BOTS, formatMoney, formatPrice } from "@/lib/assets";
import { calculateRapidLiveState } from "@/lib/trade-pnl";
import { cn } from "@/lib/utils";
import { useAccountMode } from "@/components/account-mode";
import { useThemeMode } from "@/components/theme-mode";

const searchSchema = z.object({ symbol: z.string().optional() });
type Direction = "up" | "down";

function playOutcomeSound(outcome: "won" | "lost") {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  const now = context.currentTime;
  if (outcome === "won") {
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, now);
    oscillator.frequency.setValueAtTime(980, now + 0.09);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  } else {
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(150, now);
    oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.35);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  }
  oscillator.start(now);
  oscillator.stop(now + (outcome === "won" ? 0.3 : 0.4));
  oscillator.addEventListener("ended", () => void context.close());
}
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
  const hours = Math.floor(left / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  const seconds = left % 60;
  const display = hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return <span className="num font-semibold text-foreground">{left > 0 ? display + " left" : "Settling"}</span>;
}

function ActivePosition({ trade, currentPrice, now, stopping, onStop }: { trade: NonNullable<ReturnType<typeof useAccount>["data"]>["trades"][number]; currentPrice: number | undefined; now: number; stopping: boolean; onStop: () => void }) {
  const entry = Number(trade.entry_price);
  const hasLevels = trade.take_profit_price !== null && trade.stop_loss_price !== null;
  const tp = hasLevels ? Number(trade.take_profit_price) : entry;
  const sl = hasLevels ? Number(trade.stop_loss_price) : entry;
  const liveState = calculateRapidLiveState(trade, currentPrice, now);
  const price = liveState.price;
  const movement = trade.direction === "up" ? price - entry : entry - price;
  const targetDistance = tp && sl ? Math.max(Math.abs(tp - entry), Math.abs(sl - entry)) : 1;
  const progress = Math.max(-100, Math.min(100, (movement / targetDistance) * 100));
  const favorable = movement >= 0;
  const stake = Number(trade.stake);
  const livePnl = liveState.pnl;
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
            <div className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5"><span className="text-muted-foreground">Take Profit</span><p className="num font-semibold text-primary">+${formatMoney(Number(trade.take_profit_amount ?? (stake * Number(trade.take_profit_percent ?? 0)) / 100))}</p></div>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5"><span className="text-muted-foreground">Stop Loss</span><p className="num font-semibold text-destructive">-${formatMoney(Number(trade.stop_loss_amount ?? (stake * Number(trade.stop_loss_percent ?? 0)) / 100))}</p></div>
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

      <Button type="button" variant="destructive" size="sm" className="mt-2 w-full" disabled={stopping} onClick={onStop}>{stopping ? "Stopping trade" : "Stop trade now"}</Button>
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
  const rapidNow = useRapidMarketClock();
  const submit = useServerFn(placeTrade);
  const fetchLiveStatus = useServerFn(getLiveAccountStatus);
  const { data: liveStatus } = useQuery({
    queryKey: ["live-account-status"],
    queryFn: () => fetchLiveStatus(),
    staleTime: 5 * 60 * 1000,
  });
  const stopTrade = useServerFn(stopDemoTrade);
  const stopAllTrades = useServerFn(stopAllDemoTrades);
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
  const [botStake, setBotStake] = useState("10");
  const [botTakeProfit, setBotTakeProfit] = useState("2");
  const [botStopLoss, setBotStopLoss] = useState("1");
  const [martingaleEnabled, setMartingaleEnabled] = useState(false);
  const [martingaleLevel, setMartingaleLevel] = useState("1.5");
  const botTakeProfitRef = useRef(2);
  const botStopLossRef = useRef(1);
  const botStakeRef = useRef(10);
  const botDurationRef = useRef(60);
  const activeBotPairsRef = useRef<string[]>([]);
  const baseBotStakeRef = useRef(10);
  const martingaleEnabledRef = useRef(false);
  const martingaleLevelRef = useRef(1.5);
  const processedOutcomes = useRef(new Set<string>());
  const [showBotTransactions, setShowBotTransactions] = useState(false);
  const sessionStartedAt = useRef<number | null>(null);
  const lastAutoQuote = useRef<number | null>(null);

  const quotes = markets?.quotes ?? [];
  const quote = quotes.find((item) => item.symbol === symbol);
  /** Real accounts trade the generated crypto instruments, Demo trades the exchange pairs. */
  const marketList = useMemo(
    () => (mode === "live"
      ? SYNTHETIC_INSTRUMENTS.map((item) => ({ symbol: item.symbol, name: item.name, payoutRate: item.payoutRate }))
      : TRADABLE_ASSETS.map((item) => ({ symbol: item.symbol, name: item.name, payoutRate: item.payoutRate }))),
    [mode],
  );
  useEffect(() => {
    if (!marketList.some((item) => item.symbol === symbol)) setSymbol(marketList[0]!.symbol);
  }, [marketList, symbol]);
  const asset = marketList.find((item) => item.symbol === symbol);
  const unit = mode === "demo" ? "USD" : "USDT";
  const balance = account?.profile ? Number(mode === "demo" ? account.profile.demo_balance : account.profile.live_balance) : 0;
  const stakeValue = Number(stake) || 0;
  const validStake = stakeValue >= 0.35 && stakeValue <= 500 && stakeValue <= balance;
  const takeProfitValue = Number(takeProfit) || 0;
  const stopLossValue = Number(stopLoss) || 0;
  const validLevels = takeProfitValue >= 0.1 && takeProfitValue <= 2000 && stopLossValue >= 0.1 && stopLossValue <= stakeValue;
  const effectiveTakeProfit = Math.max(0.1, Math.round(takeProfitValue * 100) / 100);
  const effectiveStopLoss = Math.max(0.1, Math.round(stopLossValue * 100) / 100);
  const selectedBot = TRADING_BOTS.find((bot) => bot.id === botId);
  const payout = asset ? (stakeValue * asset.payoutRate) / 100 : 0;
  const openTrades = (account?.trades ?? []).filter((trade) => trade.status === "open" && trade.account_mode === mode);
  const signal = useMemo(() => signalFor(quote?.sparkline ?? [], quote?.change24h ?? 0), [quote]);
  const openAutoSymbols = useMemo(() => new Set(openTrades.filter((trade) => trade.trade_source === "auto").map((trade) => trade.symbol)), [openTrades]);
  const autoCandidate = useMemo(() => {
    const tradable = new Set(marketList.map((item) => item.symbol));
    const universe = quotes.filter((item) => tradable.has(item.symbol));
    const allowed = activeBotPairsRef.current;
    const pool = allowed.length > 0 ? universe.filter((item) => allowed.includes(item.symbol)) : universe;
    const available = (pool.length > 0 ? pool : universe)
      .map((item) => ({ quote: item, signal: signalFor(item.sparkline, item.change24h) }))
      .filter((item) => !openAutoSymbols.has(item.quote.symbol));
    const ranked = available
      .filter((item) => item.signal.direction !== "wait" && item.signal.confidence >= Number(autoMinimum))
      .sort((a, b) => b.signal.confidence - a.signal.confidence)[0];
    if (ranked) return ranked;
    const fallback = [...available].sort((a, b) => Math.abs(b.quote.change24h) - Math.abs(a.quote.change24h))[0];
    if (!fallback) return undefined;
    return {
      quote: fallback.quote,
      signal: {
        direction: (fallback.quote.change24h >= 0 ? "up" : "down") as "up" | "down",
        confidence: Math.max(80, Math.min(87, Number(autoMinimum) || 80)),
        reason: "Strongest daily move available",
      },
    };
  }, [autoMinimum, marketList, openAutoSymbols, quotes]);
  const sessionLoss = (account?.trades ?? [])
    .filter((trade) => trade.trade_source === "auto" && trade.status !== "open" && sessionStartedAt.current !== null && new Date(trade.created_at).getTime() >= sessionStartedAt.current)
    .reduce((total, trade) => total + Math.max(0, 0 - Number(trade.pnl ?? 0)), 0);
  const sparkline = quote?.sparkline ?? [];
  const sessionHigh = sparkline.length > 0 ? Math.max(...sparkline) : null;
  const sessionLow = sparkline.length > 0 ? Math.min(...sparkline) : null;
  const sessionOpen = sparkline.length > 0 ? sparkline[0] : null;
  // Real trading, manual or bot, opens only once funding is switched on.
  const locked = mode === "live" && !liveStatus?.enabled;

  const mutation = useMutation({
    mutationFn: ({ direction, source, selectedSymbol = symbol, selectedStake = stakeValue, selectedDuration = duration }: { direction: Direction; source: TradeSource; selectedSymbol?: string; selectedStake?: number; selectedDuration?: number }) =>
      submit({ data: { accountMode: mode, symbol: selectedSymbol, direction, stake: selectedStake, durationSeconds: selectedDuration, source, takeProfitPercent: source === "auto" ? botTakeProfitRef.current : effectiveTakeProfit, stopLossPercent: source === "auto" ? botStopLossRef.current : effectiveStopLoss } }),
    onSuccess: (res, variables) => {
      // Show the new position instantly, before the account query refetches.
      queryClient.setQueryData(["account"], (old: unknown) => {
        const previous = old as { trades?: unknown[]; profile?: Record<string, unknown> } | undefined;
        if (!previous?.trades) return old;
        return {
          ...previous,
          trades: [res.trade, ...previous.trades],
          profile: previous.profile ? { ...previous.profile, demo_balance: res.balance } : previous.profile,
        };
      });
      queryClient.invalidateQueries({ queryKey: ["account"] });
      if (variables.source === "auto") setAutoPlaced((value) => value + 1);
    },
    onError: (error) => {
      setAutoEnabled(false);
      toast.error(error instanceof Error ? error.message : "Could not open the trade.");
    },
  });

  const stopMutation = useMutation({
    mutationFn: (tradeId: string) => stopTrade({ data: { tradeId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not stop the Demo trade."),
  });

  const stopAllMutation = useMutation({
    mutationFn: () => stopAllTrades(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not close the open Demo trades."),
  });

  const disabled = locked || mutation.isPending || !validStake || !validLevels;

  useEffect(() => {
    // Switching account stops any running bot session so it never carries over between balances.
    setAutoEnabled(false);
  }, [mode]);

  useEffect(() => {
    if (!autoEnabled || !autoCandidate || mutation.isPending || locked) return;

    if (Date.now() - dataUpdatedAt > 60_000) return;
    const botStake = botStakeRef.current;
    if (autoPlaced >= Math.min(20, Math.max(5, Number(autoLimit) || 5)) || sessionLoss >= Math.max(1, Number(lossLimit) || 0) || botStake > balance) {
      setAutoEnabled(false);
      return;
    }
    if (lastAutoQuote.current === dataUpdatedAt) return;
    lastAutoQuote.current = dataUpdatedAt;
    const autoDirection: Direction = autoCandidate.signal.direction === "down" ? "down" : "up";
    setSymbol(autoCandidate.quote.symbol);
    mutation.mutate({ direction: autoDirection, source: "auto", selectedSymbol: autoCandidate.quote.symbol, selectedStake: botStake, selectedDuration: botDurationRef.current });
  }, [autoCandidate, autoEnabled, autoLimit, autoPlaced, balance, dataUpdatedAt, lossLimit, mutation, sessionLoss]);


  useEffect(() => {
    const completed = (account?.trades ?? [])
      .filter((trade) => trade.trade_source === "auto" && trade.status !== "open" && sessionStartedAt.current !== null && new Date(trade.created_at).getTime() >= sessionStartedAt.current)
      .sort((a, b) => new Date(a.settled_at ?? a.created_at).getTime() - new Date(b.settled_at ?? b.created_at).getTime());
    for (const trade of completed) {
      if (processedOutcomes.current.has(trade.id)) continue;
      processedOutcomes.current.add(trade.id);
      if (trade.status === "won" || trade.status === "lost") playOutcomeSound(trade.status);
      if (!martingaleEnabledRef.current) continue;
      botStakeRef.current = trade.status === "lost"
        ? Math.min(2000, balance, Math.round(Number(trade.stake) * martingaleLevelRef.current * 100) / 100)
        : baseBotStakeRef.current;
    }
  }, [account?.trades, balance]);

  function openBotSetup(bot = selectedBot) {
    if (!bot) return;
    setPendingBotId(bot.id);
    setBotDuration(String(Math.min(3600, Math.max(30, bot.durationSeconds))));
    setBotTradeCount(String(Math.min(20, Math.max(5, bot.tradeLimit))));
    setBotStake(stakeValue >= 0.35 && stakeValue <= 2000 ? stake : "10");
    setBotTakeProfit(takeProfit);
    setBotStopLoss(stopLoss);
    setBotSetupOpen(true);
  }

  function startAutoTrading() {
    const bot = TRADING_BOTS.find((item) => item.id === pendingBotId) ?? selectedBot;
    const maxBotStake = mode === "demo" ? 2000 : 200;
    const configuredDuration = Math.min(3600, Math.max(30, Number(botDuration) || 30));
    const configuredTradeCount = Math.min(20, Math.max(5, Number(botTradeCount) || 5));
    const configuredStake = Math.min(maxBotStake, Math.max(0.35, Number(botStake) || 0.35));
    const configuredTakeProfit = Math.min(2000, Math.max(0.1, Number(botTakeProfit) || 0.1));
    const configuredStopLoss = Math.min(configuredStake, Math.max(0.1, Number(botStopLoss) || 0.1));
    const configuredMartingale = Math.min(5.5, Math.max(1.25, Number(martingaleLevel) || 1.25));
    if (configuredStake > balance) {
      toast.error(mode === "demo" ? "Bot amount is higher than your Demo balance." : "Bot amount is higher than your available balance.");
      return;
    }
    botDurationRef.current = configuredDuration;
    activeBotPairsRef.current = bot?.pairs ?? [];
    if (bot) {
      setBotId(bot.id);
      setDuration(configuredDuration);
      setAutoLimit(String(configuredTradeCount));
    }
    sessionStartedAt.current = Date.now();
    botTakeProfitRef.current = configuredTakeProfit;
    botStopLossRef.current = configuredStopLoss;
    botStakeRef.current = configuredStake;
    baseBotStakeRef.current = configuredStake;
    martingaleEnabledRef.current = martingaleEnabled;
    martingaleLevelRef.current = configuredMartingale;
    processedOutcomes.current.clear();
    setAutoPlaced(0);
    lastAutoQuote.current = null;
    setAutoEnabled(true);
    setBotSetupOpen(false);
    setShowBotTransactions(true);
    
  }

  function stopAutoTrading() {
    // Block any further bot entries straight away, then close every running
    // Demo trade at its current live result, profit or loss.
    setAutoEnabled(false);
    setAutoPlaced(Math.min(20, Math.max(5, Number(autoLimit) || 5)));
    lastAutoQuote.current = null;
    stopAllMutation.mutate();
  }

  function resetBotSession() {
    setAutoEnabled(false);
    setAutoPlaced(0);
    sessionStartedAt.current = Date.now();
    botStakeRef.current = baseBotStakeRef.current;
    processedOutcomes.current.clear();
    lastAutoQuote.current = null;
    
  }

  const sessionBotTrades = (account?.trades ?? []).filter((trade) => trade.trade_source === "auto" && sessionStartedAt.current !== null && new Date(trade.created_at).getTime() >= sessionStartedAt.current);
  const sessionBotPnl = sessionBotTrades.reduce((total, trade) => total + (trade.status === "open" ? calculateRapidLiveState(trade, quotes.find((item) => item.symbol === trade.symbol)?.price, rapidNow).pnl : Number(trade.pnl)), 0);

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

      {showBotTransactions ? (
        <section className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Bot transactions</p><h1 className="mt-1 text-lg font-semibold">{selectedBot?.name ?? "Trading Bot"}</h1></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setShowBotTransactions(false)}><ArrowLeft className="size-4" /> Trade setup</Button><Button variant="outline" size="sm" onClick={resetBotSession}><RotateCcw className="size-4" /> Reset</Button><Button variant="destructive" size="sm" onClick={stopAutoTrading} disabled={stopAllMutation.isPending || (!autoEnabled && openTrades.length === 0)}><Square className="size-4" /> {stopAllMutation.isPending ? "Closing trades" : "Stop bot"}</Button></div>
          </div>
          <div className="grid grid-cols-3 border-b border-border bg-secondary/20 text-center">
            <div className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Runs</p><p className="num mt-1 font-semibold">{autoPlaced} / {autoLimit}</p></div>
            <div className="border-x border-border p-3"><p className="text-[10px] uppercase text-muted-foreground">Live PNL</p><p className={cn("num mt-1 font-semibold", sessionBotPnl >= 0 ? "text-primary" : "text-destructive")}>{sessionBotPnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(sessionBotPnl))} USD</p></div>
            <div className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Status</p><p className={cn("mt-1 font-semibold", autoEnabled ? "text-primary" : "text-muted-foreground")}>{autoEnabled ? "Running" : "Stopped"}</p></div>
          </div>
          {sessionBotTrades.length === 0 ? <div className="px-4 py-16 text-center"><Bot className="mx-auto size-8 text-primary" /><p className="mt-3 font-semibold">Scanning all crypto markets</p><p className="mt-1 text-sm text-muted-foreground">The first eligible trade will appear here automatically.</p></div> : <div className="divide-y divide-border">{sessionBotTrades.map((trade) => {
            const currentPrice = quotes.find((item) => item.symbol === trade.symbol)?.price;
            const liveState = calculateRapidLiveState(trade, currentPrice, rapidNow);
            const pnl = trade.status === "open" ? liveState.pnl : Number(trade.pnl);
            const tradeStake = Number(trade.stake);
            const tpAmount = Number(trade.take_profit_amount ?? (tradeStake * Number(trade.take_profit_percent ?? 0)) / 100);
            const slAmount = Number(trade.stop_loss_amount ?? (tradeStake * Number(trade.stop_loss_percent ?? 0)) / 100);
            return <div key={trade.id} className="grid grid-cols-[1fr_auto] gap-3 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center"><div className="flex items-center gap-2"><AssetIcon symbol={trade.symbol} className="size-7" /><div><p className="font-semibold">{trade.symbol} <span className={trade.direction === "up" ? "text-primary" : "text-destructive"}>{trade.direction === "up" ? "Up" : "Down"}</span></p><p className="text-[11px] text-muted-foreground">{formatMoney(tradeStake)} USD | {trade.status === "open" ? <Countdown expiresAt={trade.expires_at} /> : `${trade.duration_seconds}s`}</p></div></div><div className="hidden text-xs sm:block"><p className="text-muted-foreground">Entry / Live</p><p className="num mt-1">{formatPrice(Number(trade.entry_price))} / {formatPrice(trade.status === "open" ? liveState.price : Number(trade.exit_price ?? trade.entry_price))}</p></div><div className="hidden text-xs sm:block"><p className="text-muted-foreground">TP / SL</p><p className="num mt-1">+${formatMoney(tpAmount)} / -${formatMoney(slAmount)}</p></div><div className="text-right"><p className={cn("num font-semibold tabular-nums transition-colors", pnl >= 0 ? "text-primary" : "text-destructive")}>{pnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(pnl))}</p><p className="mt-1 text-[11px] capitalize text-muted-foreground">{trade.status === "open" ? "Live now" : trade.status}</p></div></div>;
          })}</div>}
        </section>
      ) : <div className="grid gap-2 lg:grid-cols-12">
        {/* Market list */}
        <section className="order-3 flex flex-col rounded-lg border border-border bg-card lg:order-1 lg:col-span-3">
          <PanelTitle right={<span className="text-[10px] text-muted-foreground">{marketList.length} markets</span>}>Market assets</PanelTitle>
          <ul className="max-h-[320px] overflow-y-auto lg:max-h-[560px]">
            {marketList.map((item) => {
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
              {isSyntheticSymbol(symbol)
                ? <SyntheticChart symbol={symbol} interval={candleInterval} theme={theme} className="h-full w-full" />
                : <CandlestickChart symbol={symbol} interval={candleInterval} theme={theme} className="h-full w-full" />}
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
              <span className="text-[11px] text-muted-foreground">Read only guidance. Place trades yourself from the order pad.</span>
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
                    now={rapidNow}
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
                <span className="num text-[10px] text-muted-foreground">Min 0.35 | Max 500</span>
              </div>
              <Input id="stake" className="num mt-2 h-11 text-base font-semibold" type="number" inputMode="decimal" min="0.35" max="500" step="0.01" value={stake} onChange={(event) => setStake(event.target.value)} />
              <div className="mt-1.5 grid grid-cols-5 gap-1">
                {[10, 50, 100, 250, 500].map((value) => (
                  <Button key={value} type="button" size="sm" variant="secondary" className="h-7 px-0 text-[10px]" onClick={() => setStake(String(value))}>{value}</Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="takeProfit" className="text-[10px] uppercase tracking-widest text-muted-foreground">Take profit (USD)</Label>
                <Input id="takeProfit" className="num mt-1.5 h-9" type="number" inputMode="decimal" min="0.1" max="2000" step="0.1" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="stopLoss" className="text-[10px] uppercase tracking-widest text-muted-foreground">Stop loss (USD)</Label>
                <Input id="stopLoss" className="num mt-1.5 h-9" type="number" inputMode="decimal" min="0.1" max={stakeValue || 1} step="0.1" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} />
              </div>
            </div>
            <p className="flex items-start gap-2 text-[11px] text-muted-foreground"><Target className="mt-0.5 size-3.5 shrink-0" />Target profit +${formatMoney(effectiveTakeProfit)} | Maximum loss -${formatMoney(effectiveStopLoss)}. The x{multiplier} setting changes price sensitivity.</p>

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

                <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {TRADING_BOTS.map((bot) => (
                    <li key={bot.id}>
                      <button
                        type="button"
                        onClick={() => openBotSetup(bot)}
                        disabled={locked}
                        className={cn("w-full rounded-md border px-2.5 py-2 text-left transition-colors", botId === bot.id ? "border-primary bg-primary/10" : "border-border/70 hover:bg-secondary/40")}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{bot.name}</span>
                          <span className="num text-[10px] text-muted-foreground">{bot.tradeLimit} trades | x{bot.multiplier} | {bot.durationSeconds < 60 ? `${bot.durationSeconds}s` : `${bot.durationSeconds / 60}m`}</span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{bot.description}</span>
                        <span className="num mt-1 block text-[10px] font-semibold text-primary">{bot.pairs.map((pair) => `${pair}/USDT`).join(" | ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="grid grid-cols-3 gap-1.5">
                  <div><Label htmlFor="confidence" className="text-[10px] text-muted-foreground">Min conf.</Label><Input id="confidence" className="num mt-1 h-8 px-2 text-xs" type="number" min="80" max="87" inputMode="numeric" value={autoMinimum} onChange={(event) => setAutoMinimum(event.target.value)} /></div>
                  <div><Label htmlFor="tradeLimit" className="text-[10px] text-muted-foreground">Max trades</Label><Input id="tradeLimit" className="num mt-1 h-8 px-2 text-xs" type="number" min="5" max="20" inputMode="numeric" value={autoLimit} onChange={(event) => setAutoLimit(event.target.value)} /></div>
                  <div><Label htmlFor="lossLimit" className="text-[10px] text-muted-foreground">Max loss</Label><Input id="lossLimit" className="num mt-1 h-8 px-2 text-xs" type="number" min="0" max="500" inputMode="decimal" value={lossLimit} onChange={(event) => setLossLimit(event.target.value)} /></div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-10" onClick={() => openBotSetup()} disabled={locked || autoEnabled}>
                    <Play className="size-4" /> Start trading
                  </Button>
                  <Button variant="destructive" className="h-10" onClick={stopAutoTrading} disabled={stopAllMutation.isPending || (!autoEnabled && openTrades.length === 0)}>
                    <Square className="size-4" /> Stop trading
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">{autoEnabled ? `${selectedBot?.name ?? "Bot"} running. ${autoPlaced} of ${Number(autoLimit) || 0} trades placed across different markets. Session loss ${formatMoney(sessionLoss)} USD.` : "Tap a bot to start its trade sequence. Demo outcomes target a simulated 95 percent practice win rate and still include losses."}</p>
              </div>
            )}

            <p className="flex items-start gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />{mode === "demo" ? "Every trade uses simulated money and appears in History with its balance result." : `Real trades run on CryptoMagg synthetic crypto instruments. These are generated price series, not real coins, identical for every trader and set only by the clock. A win pays ${LIVE_PAYOUT_RATE} percent of your amount, a loss costs the full amount.`}</p>
          </div>
        </aside>
      </div>}

      <p className="rounded-lg border border-dashed border-border bg-card/40 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {mode === "demo"
          ? "Simulation mode | No real funds involved | Virtual balance for practice only"
          : `Real account | Synthetic crypto instruments, not real coins | Win pays ${LIVE_PAYOUT_RATE} percent, a loss costs your full amount`}
      </p>

      <Dialog open={botSetupOpen} onOpenChange={setBotSetupOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg bg-card p-0">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>Set up trading bot</DialogTitle>
            <DialogDescription>Every setting is editable. The bot picks the strongest of its own five pairs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5 py-4">
            <div>
              <Label htmlFor="botStake">Amount per trade (USD)</Label>
              <Input id="botStake" className="num mt-2 h-11" type="number" inputMode="decimal" min="0.35" max="2000" step="0.01" value={botStake} onChange={(event) => setBotStake(event.target.value)} />
              <p className="mt-1.5 text-xs text-muted-foreground">Minimum 0.35 USD | Maximum 2,000 USD</p>
            </div>
            <div>
              <Label htmlFor="botDuration">How long should each trade run?</Label>
              <select id="botDuration" value={botDuration} onChange={(event) => setBotDuration(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                {DURATIONS.filter((item) => item.seconds <= 3600).map((item) => <option key={item.seconds} value={item.seconds}>{item.label}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">Minimum 30 seconds | Maximum 1 hour</p>
            </div>
            <div>
              <Label htmlFor="botTradeCount">How many trades should the bot run?</Label>
              <Input id="botTradeCount" className="num mt-2 h-11" type="number" inputMode="numeric" min="5" max="20" step="1" value={botTradeCount} onChange={(event) => setBotTradeCount(event.target.value)} />
              <p className="mt-1.5 text-xs text-muted-foreground">Minimum 5 trades | Maximum 20 trades</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="botTakeProfit">Take Profit (USD)</Label><Input id="botTakeProfit" className="num mt-2 h-11" type="number" inputMode="decimal" min="0.1" max="2000" step="0.1" value={botTakeProfit} onChange={(event) => setBotTakeProfit(event.target.value)} /></div>
              <div><Label htmlFor="botStopLoss">Stop Loss (USD)</Label><Input id="botStopLoss" className="num mt-2 h-11" type="number" inputMode="decimal" min="0.1" max="2000" step="0.1" value={botStopLoss} onChange={(event) => setBotStopLoss(event.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label htmlFor="botConfidence" className="text-xs">Min conf.</Label><Input id="botConfidence" className="num mt-2 h-11 px-2" type="number" inputMode="numeric" min="80" max="87" value={autoMinimum} onChange={(event) => setAutoMinimum(event.target.value)} /></div>
              <div><Label htmlFor="botLossLimit" className="text-xs">Max loss</Label><Input id="botLossLimit" className="num mt-2 h-11 px-2" type="number" inputMode="decimal" min="0" max="2000" value={lossLimit} onChange={(event) => setLossLimit(event.target.value)} /></div>
              <div><Label htmlFor="botMultiplier" className="text-xs">Multiplier</Label><select id="botMultiplier" value={multiplier} onChange={(event) => setMultiplier(Number(event.target.value))} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-2 text-sm">{MULTIPLIERS.map((item) => <option key={item} value={item}>x{item}</option>)}</select></div>
            </div>
            <div>
              <Label className="text-xs">Pairs this bot trades</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(TRADING_BOTS.find((item) => item.id === pendingBotId)?.pairs ?? []).map((pair) => (
                  <span key={pair} className="num rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] font-semibold">{pair}/USDT</span>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-3"><div><Label htmlFor="martingale">Martingale</Label><p className="mt-1 text-xs text-muted-foreground">After a loss, multiply the next trade amount. A win resets it.</p></div><Switch id="martingale" checked={martingaleEnabled} onCheckedChange={setMartingaleEnabled} /></div>
              {martingaleEnabled ? <div className="mt-3"><Label htmlFor="martingaleLevel">Martingale level</Label><Input id="martingaleLevel" className="num mt-2 h-11" type="number" inputMode="decimal" min="1.25" max="5.5" step="0.05" value={martingaleLevel} onChange={(event) => setMartingaleLevel(event.target.value)} /><p className="mt-1.5 text-xs text-muted-foreground">Minimum 1.25x | Maximum 5.5x | Never above 2,000 USD</p></div> : null}
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground"><Volume2 className="mt-0.5 size-4 shrink-0" />A ping plays after a win and a bang plays after a loss.</p>
            <div className="rounded-md border border-primary/25 bg-primary/10 p-3 text-sm">
              <p className="font-semibold">Automatic market selection</p>
              <p className="mt-1 text-xs text-muted-foreground">The bot scans all available assets and picks a different eligible market for each open trade.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border px-5 py-4 sm:space-x-0">
            <Button type="button" variant="secondary" onClick={() => setBotSetupOpen(false)}>Cancel</Button>
            <Button type="button" onClick={startAutoTrading} disabled={Number(botStake) < 0.35 || Number(botStake) > 2000 || Number(botStake) > balance || Number(botTradeCount) < 5 || Number(botTradeCount) > 20 || Number(botDuration) < 30 || Number(botDuration) > 3600 || Number(botTakeProfit) < 0.1 || Number(botTakeProfit) > 2000 || Number(botStopLoss) < 0.1 || (martingaleEnabled && (Number(martingaleLevel) < 1.25 || Number(martingaleLevel) > 5.5))}>
              <Play className="size-4" /> Start bot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
