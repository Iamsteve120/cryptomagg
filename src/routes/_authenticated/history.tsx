import { createFileRoute } from "@tanstack/react-router";
import { tr } from "@/lib/i18n";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Bot, CircleUserRound, Repeat2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetIcon } from "@/components/ui/asset-icon";
import { useAccount, useMarkets, useRapidMarketClock } from "@/hooks/use-trading";
import { formatMoney, formatPrice } from "@/lib/assets";
import { calculateRapidLiveState } from "@/lib/trade-pnl";
import { cn } from "@/lib/utils";
import { useAccountMode, type AccountMode } from "@/components/account-mode";
import { StatCard } from "@/components/market-widgets";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History | CryptoMagg" },
      { name: "description", content: "Review every CryptoMagg trade and its exact account balance effect." },
      { property: "og:title", content: "History | CryptoMagg" },
      { property: "og:description", content: "Your complete trade and wallet record." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function when(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function money(value: number | null, mode: string) {
  return value === null ? "Unavailable" : `${formatMoney(Number(value))} ${mode === "demo" ? "USD" : "USDT"}`;
}

function sourceLabel(source: string) {
  if (source === "scanner") return { label: "AI Scanner", icon: ScanLine };
  if (source === "assist") return { label: "Assisted", icon: ScanLine };
  if (source === "auto") return { label: "Automatic", icon: Repeat2 };
  return { label: "Manual", icon: CircleUserRound };
}

function HistoryPage() {
  const { mode } = useAccountMode();
  const { data } = useAccount();
  const { data: markets } = useMarkets();
  const rapidNow = useRapidMarketClock();
  const [filter, setFilter] = useState<"all" | AccountMode>(mode);
  const trades = (data?.trades ?? []).filter((trade) => filter === "all" || trade.account_mode === filter);
  const transactions = (data?.transactions ?? []).filter((transaction) => filter === "all" || transaction.account_mode === filter);
  const totals = trades.filter((trade) => trade.status !== "open").reduce((summary, trade) => ({
    pnl: summary.pnl + Number(trade.pnl),
    takeProfit: summary.takeProfit + Number(trade.take_profit_amount ?? (Number(trade.stake) * Number(trade.take_profit_percent ?? 0)) / 100),
    stopLoss: summary.stopLoss + Number(trade.stop_loss_amount ?? (Number(trade.stake) * Number(trade.stop_loss_percent ?? 0)) / 100),
  }), { pnl: 0, takeProfit: 0, stopLoss: 0 });
  const botTrades = trades.filter((trade) => trade.trade_source === "auto");
  const runningBotTrades = botTrades.filter((trade) => trade.status === "open");
  const botLivePnl = runningBotTrades.reduce((total, trade) => {
    const currentPrice = markets?.quotes.find((quote) => quote.symbol === trade.symbol)?.price;
    return total + calculateRapidLiveState(trade, currentPrice, rapidNow).pnl;
  }, 0);
  const botSettledPnl = botTrades.filter((trade) => trade.status !== "open").reduce((total, trade) => total + Number(trade.pnl), 0);
  const totalUnit = filter === "live" ? "USDT" : filter === "demo" ? "USD" : "USD value";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{tr("History")}</h1><p className="text-sm text-muted-foreground">{tr("Every account movement in one auditable record.")}</p></div>
        <div className="flex rounded-md border border-border bg-secondary/40 p-1" aria-label={tr("History account filter")}>
          {(["all", "demo", "live"] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? "secondary" : "ghost"} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "demo" ? "Demo" : "Real"}</Button>)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total PNL" value={`${totals.pnl < 0 ? "-" : totals.pnl > 0 ? "+" : ""}${formatMoney(Math.abs(totals.pnl))} ${totalUnit}`} hint="Settled results in this filter" tone={totals.pnl > 0 ? "positive" : totals.pnl < 0 ? "negative" : "default"} />
        <StatCard label="Total TP target" value={`${formatMoney(totals.takeProfit)} ${totalUnit}`} hint="Combined take profit amount" tone="positive" />
        <StatCard label="Total SL risk" value={`${formatMoney(totals.stopLoss)} ${totalUnit}`} hint="Combined stop loss amount" tone="negative" />
      </div>

      <section className="rounded-lg border border-primary/30 bg-card p-4" aria-label={tr("Bot PNL summary")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><Bot className="size-5" /></span>
            <div><h2 className="font-semibold">{tr("Trading Bot PNL")}</h2><p className="text-xs text-muted-foreground">{tr("Updates while automatic trades are running")}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-5 text-right">
            <div><p className="text-[10px] uppercase text-muted-foreground">{tr("Running")}</p><p className="num font-semibold">{runningBotTrades.length}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">{tr("Live PNL")}</p><p className={cn("num font-semibold", botLivePnl >= 0 ? "text-primary" : "text-destructive")}>{botLivePnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(botLivePnl))} {totalUnit}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">{tr("Settled PNL")}</p><p className={cn("num font-semibold", botSettledPnl >= 0 ? "text-primary" : "text-destructive")}>{botSettledPnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(botSettledPnl))} {totalUnit}</p></div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="trades">
        <TabsList><TabsTrigger value="trades">{tr("Trades")}</TabsTrigger><TabsTrigger value="transactions">{tr("Transactions")}</TabsTrigger><TabsTrigger value="wallet">{tr("Wallet")}</TabsTrigger></TabsList>
        <TabsContent value="trades">
          {trades.length === 0 ? <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">{tr("No trades match this account filter.")}</div> : <div className="grid gap-3">{trades.map((trade) => {
            const source = sourceLabel(trade.trade_source);
            const SourceIcon = source.icon;
            const resultingBalance = trade.balance_after_settlement ?? trade.balance_after_open;
            const currentPrice = markets?.quotes.find((quote) => quote.symbol === trade.symbol)?.price;
            const liveState = calculateRapidLiveState(trade, currentPrice, rapidNow);
            const livePnl = trade.status === "open" ? liveState.pnl : null;
            const displayedResult = livePnl ?? Number(trade.pnl);
            return <article key={trade.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-full border border-border bg-secondary"><AssetIcon symbol={trade.symbol} /></div><div><p className="font-semibold">{trade.symbol} <span className={trade.direction === "up" ? "text-primary" : "text-destructive"}>{trade.direction === "up" ? <ArrowUpRight className="inline size-4" /> : <ArrowDownRight className="inline size-4" />} {trade.direction === "up" ? "Up" : "Down"}</span></p><p className="text-xs text-muted-foreground">{when(trade.created_at)}</p></div></div>
                <div className="flex items-center gap-2"><span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium">{trade.account_mode === "demo" ? "Demo" : "Real"}</span><span className={cn("rounded-md px-2 py-1 text-xs font-semibold capitalize", trade.status === "won" ? "bg-primary/15 text-primary" : trade.status === "lost" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground")}>{trade.status}</span></div>
              </div>
              {livePnl !== null ? <div className={cn("mt-3 flex items-center justify-between rounded-md border p-3 transition-colors", livePnl >= 0 ? "border-primary/30 bg-primary/10" : "border-destructive/30 bg-destructive/10")}><div><p className="text-xs uppercase text-muted-foreground">{tr("Live PNL now")}</p><p className={cn("num mt-1 text-xl font-semibold tabular-nums", livePnl >= 0 ? "text-primary" : "text-destructive")}>{livePnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(livePnl))} {trade.account_mode === "demo" ? "USD" : "USDT"}</p></div><div className="text-right text-xs text-muted-foreground"><p>Live ${formatPrice(liveState.price)}</p><p>{tr("Updating rapidly")}</p></div></div> : null}
              <div className="mt-4 grid gap-3 border-y border-border py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <div><p className="text-xs text-muted-foreground">{tr("Source")}</p><p className="mt-1 flex items-center gap-1.5 font-medium"><SourceIcon className="size-4" />{source.label}</p></div>
                <div><p className="text-xs text-muted-foreground">{tr("Opening balance")}</p><p className="num mt-1 font-medium">{money(trade.balance_before, trade.account_mode)}</p></div>
                <div><p className="text-xs text-muted-foreground">{tr("Stake")}</p><p className="num mt-1 font-medium">{money(Number(trade.stake), trade.account_mode)}</p></div>
                <div><p className="text-xs text-muted-foreground">{tr("After opening")}</p><p className="num mt-1 font-medium">{money(trade.balance_after_open, trade.account_mode)}</p></div>
                <div><p className="text-xs text-muted-foreground">{trade.status === "open" ? "Live result" : "Final result"}</p><p className={cn("num mt-1 font-semibold", displayedResult > 0 ? "text-primary" : displayedResult < 0 ? "text-destructive" : "text-muted-foreground")}>{displayedResult > 0 ? "+" : displayedResult < 0 ? "-" : ""}{formatMoney(Math.abs(displayedResult))} {trade.account_mode === "demo" ? "USD" : "USDT"}</p></div>
                <div><p className="text-xs text-muted-foreground">{trade.status === "open" ? "Balance after opening" : "Resulting balance"}</p><p className="num mt-1 font-semibold text-primary">{money(resultingBalance, trade.account_mode)}</p></div>
              </div>
              <p className="num mt-3 text-xs text-muted-foreground">Entry ${formatPrice(Number(trade.entry_price))} to {trade.exit_price ? "$" + formatPrice(Number(trade.exit_price)) : "Pending"} | TP +${formatMoney(Number(trade.take_profit_amount ?? (Number(trade.stake) * Number(trade.take_profit_percent ?? 0)) / 100))} | SL -${formatMoney(Number(trade.stop_loss_amount ?? (Number(trade.stake) * Number(trade.stop_loss_percent ?? 0)) / 100))} | {trade.duration_seconds}s</p>
            </article>;
          })}</div>}
        </TabsContent>
        <TabsContent value="transactions">
          <div className="grid gap-2 sm:hidden">
            {trades.length === 0 ? <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-muted-foreground">{tr("No trade transactions match this account filter.")}</div> : trades.map((trade) => {
              const source = sourceLabel(trade.trade_source);
              const SourceIcon = source.icon;
              const currentPrice = markets?.quotes.find((quote) => quote.symbol === trade.symbol)?.price;
               const transactionPnl = trade.status === "open" ? calculateRapidLiveState(trade, currentPrice, rapidNow).pnl : Number(trade.pnl);
              return <article key={trade.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><AssetIcon symbol={trade.symbol} className="size-7" /><div><p className="font-semibold">{trade.symbol} <span className={trade.direction === "up" ? "text-primary" : "text-destructive"}>{trade.direction === "up" ? "Up" : "Down"}</span></p><p className="num text-[11px] text-muted-foreground">{when(trade.created_at)}</p></div></div>
                  <span className={cn("rounded px-2 py-1 text-xs font-semibold capitalize", trade.status === "open" ? "bg-primary/15 text-primary" : trade.status === "lost" ? "bg-destructive/15 text-destructive" : "bg-secondary text-foreground")}>{trade.status === "open" ? "Live" : trade.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                  <div><p className="text-muted-foreground">{tr("Method")}</p><p className="mt-1 flex items-center gap-1 font-medium"><SourceIcon className="size-3.5" />{source.label}</p></div>
                  <div><p className="text-muted-foreground">{tr("Stake")}</p><p className="num mt-1 font-medium">{formatMoney(Number(trade.stake))}</p></div>
                  <div className="text-right"><p className="text-muted-foreground">{trade.status === "open" ? "Live PNL" : "PNL"}</p><p className={cn("num mt-1 font-semibold", transactionPnl >= 0 ? "text-primary" : "text-destructive")}>{transactionPnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(transactionPnl))}</p></div>
                </div>
              </article>;
            })}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card sm:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">{tr("Time")}</th><th className="px-4 py-3">{tr("Market")}</th><th className="px-4 py-3">{tr("Method")}</th><th className="px-4 py-3">{tr("Position")}</th><th className="px-4 py-3 text-right">{tr("Stake")}</th><th className="px-4 py-3 text-right">PNL</th><th className="px-4 py-3 text-right">{tr("Status")}</th></tr></thead>
              <tbody>{trades.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{tr("No trade transactions match this account filter.")}</td></tr> : trades.map((trade) => {
                const source = sourceLabel(trade.trade_source);
                const SourceIcon = source.icon;
                const currentPrice = markets?.quotes.find((quote) => quote.symbol === trade.symbol)?.price;
                 const transactionPnl = trade.status === "open" ? calculateRapidLiveState(trade, currentPrice, rapidNow).pnl : Number(trade.pnl);
                return <tr key={trade.id} className="border-t border-border/60">
                  <td className="num whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{when(trade.created_at)}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold"><AssetIcon symbol={trade.symbol} className="size-5" />{trade.symbol}</span></td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1.5"><SourceIcon className="size-4" />{source.label}</span></td>
                  <td className={cn("px-4 py-3 font-medium", trade.direction === "up" ? "text-primary" : "text-destructive")}>{trade.direction === "up" ? "Up" : "Down"}</td>
                  <td className="num px-4 py-3 text-right">{formatMoney(Number(trade.stake))} {trade.account_mode === "demo" ? "USD" : "USDT"}</td>
                  <td className={cn("num px-4 py-3 text-right font-semibold", transactionPnl >= 0 ? "text-primary" : "text-destructive")}>{transactionPnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(transactionPnl))}</td>
                  <td className="px-4 py-3 text-right"><span className={cn("rounded px-2 py-1 text-xs font-semibold capitalize", trade.status === "open" ? "bg-primary/15 text-primary" : trade.status === "lost" ? "bg-destructive/15 text-destructive" : "bg-secondary text-foreground")}>{trade.status === "open" ? "Live" : trade.status}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="wallet">
          <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[600px] text-sm"><thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">{tr("Date")}</th><th className="px-4 py-3">{tr("Account")}</th><th className="px-4 py-3">{tr("Type")}</th><th className="px-4 py-3">{tr("Method")}</th><th className="px-4 py-3 text-right">{tr("Amount")}</th></tr></thead><tbody>{transactions.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{tr("No wallet activity matches this account filter.")}</td></tr> : transactions.map((transaction) => <tr key={transaction.id} className="border-t border-border/60"><td className="num px-4 py-3 text-xs text-muted-foreground">{when(transaction.created_at)}</td><td className="px-4 py-3">{transaction.account_mode === "demo" ? "Demo" : "Real"}</td><td className="px-4 py-3 capitalize">{transaction.kind}</td><td className="px-4 py-3 text-muted-foreground">{transaction.method}</td><td className={cn("num px-4 py-3 text-right font-semibold", transaction.kind === "deposit" ? "text-primary" : "text-destructive")}>{transaction.kind === "deposit" ? "+" : transaction.kind === "withdrawal" ? "-" : ""}{formatMoney(Number(transaction.amount))} {transaction.account_mode === "demo" ? "USD" : "USDT"}</td></tr>)}</tbody></table></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}