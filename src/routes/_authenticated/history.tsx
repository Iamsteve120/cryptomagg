import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CircleUserRound, Repeat2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetIcon } from "@/components/ui/asset-icon";
import { useAccount } from "@/hooks/use-trading";
import { formatMoney, formatPrice } from "@/lib/assets";
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
  const [filter, setFilter] = useState<"all" | AccountMode>(mode);
  const trades = (data?.trades ?? []).filter((trade) => filter === "all" || trade.account_mode === filter);
  const transactions = (data?.transactions ?? []).filter((transaction) => filter === "all" || transaction.account_mode === filter);
  const totals = trades.reduce((summary, trade) => ({
    pnl: summary.pnl + Number(trade.pnl),
    takeProfit: summary.takeProfit + (Number(trade.stake) * Number(trade.take_profit_percent ?? 0)) / 100,
    stopLoss: summary.stopLoss + (Number(trade.stake) * Number(trade.stop_loss_percent ?? 0)) / 100,
  }), { pnl: 0, takeProfit: 0, stopLoss: 0 });
  const totalUnit = filter === "live" ? "USDT" : filter === "demo" ? "USD" : "USD value";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">History</h1><p className="text-sm text-muted-foreground">Every account movement in one auditable record.</p></div>
        <div className="flex rounded-md border border-border bg-secondary/40 p-1" aria-label="History account filter">
          {(["all", "demo", "live"] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? "secondary" : "ghost"} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "demo" ? "Demo" : "Real"}</Button>)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total PNL" value={`${totals.pnl < 0 ? "minus " : totals.pnl > 0 ? "+" : ""}${formatMoney(Math.abs(totals.pnl))} ${totalUnit}`} hint="Settled results in this filter" tone={totals.pnl > 0 ? "positive" : totals.pnl < 0 ? "negative" : "default"} />
        <StatCard label="Total TP target" value={`${formatMoney(totals.takeProfit)} ${totalUnit}`} hint="Combined take profit amount" tone="positive" />
        <StatCard label="Total SL risk" value={`${formatMoney(totals.stopLoss)} ${totalUnit}`} hint="Combined stop loss amount" tone="negative" />
      </div>

      <Tabs defaultValue="trades">
        <TabsList><TabsTrigger value="trades">Trades</TabsTrigger><TabsTrigger value="wallet">Wallet</TabsTrigger></TabsList>
        <TabsContent value="trades">
          {trades.length === 0 ? <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No trades match this account filter.</div> : <div className="grid gap-3">{trades.map((trade) => {
            const source = sourceLabel(trade.trade_source);
            const SourceIcon = source.icon;
            const resultingBalance = trade.balance_after_settlement ?? trade.balance_after_open;
            return <article key={trade.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-full border border-border bg-secondary"><AssetIcon symbol={trade.symbol} /></div><div><p className="font-semibold">{trade.symbol} <span className={trade.direction === "up" ? "text-primary" : "text-destructive"}>{trade.direction === "up" ? <ArrowUpRight className="inline size-4" /> : <ArrowDownRight className="inline size-4" />} {trade.direction === "up" ? "Up" : "Down"}</span></p><p className="text-xs text-muted-foreground">{when(trade.created_at)}</p></div></div>
                <div className="flex items-center gap-2"><span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium">{trade.account_mode === "demo" ? "Demo" : "Real"}</span><span className={cn("rounded-md px-2 py-1 text-xs font-semibold capitalize", trade.status === "won" ? "bg-primary/15 text-primary" : trade.status === "lost" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground")}>{trade.status}</span></div>
              </div>
              <div className="mt-4 grid gap-3 border-y border-border py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <div><p className="text-xs text-muted-foreground">Source</p><p className="mt-1 flex items-center gap-1.5 font-medium"><SourceIcon className="size-4" />{source.label}</p></div>
                <div><p className="text-xs text-muted-foreground">Opening balance</p><p className="num mt-1 font-medium">{money(trade.balance_before, trade.account_mode)}</p></div>
                <div><p className="text-xs text-muted-foreground">Stake</p><p className="num mt-1 font-medium">{money(Number(trade.stake), trade.account_mode)}</p></div>
                <div><p className="text-xs text-muted-foreground">After opening</p><p className="num mt-1 font-medium">{money(trade.balance_after_open, trade.account_mode)}</p></div>
                <div><p className="text-xs text-muted-foreground">Result</p><p className={cn("num mt-1 font-semibold", Number(trade.pnl) > 0 ? "text-primary" : Number(trade.pnl) < 0 ? "text-destructive" : "text-muted-foreground")}>{Number(trade.pnl) > 0 ? "+" : Number(trade.pnl) < 0 ? "minus " : ""}{formatMoney(Math.abs(Number(trade.pnl)))} {trade.account_mode === "demo" ? "USD" : "USDT"}</p></div>
                <div><p className="text-xs text-muted-foreground">Resulting balance</p><p className="num mt-1 font-semibold text-primary">{money(resultingBalance, trade.account_mode)}</p></div>
              </div>
              <p className="num mt-3 text-xs text-muted-foreground">Entry ${formatPrice(Number(trade.entry_price))} to {trade.exit_price ? "$" + formatPrice(Number(trade.exit_price)) : "Pending"} | TP {trade.take_profit_percent ?? "Unavailable"}% | SL {trade.stop_loss_percent ?? "Unavailable"}% | {trade.duration_seconds}s</p>
            </article>;
          })}</div>}
        </TabsContent>
        <TabsContent value="wallet">
          <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[600px] text-sm"><thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{transactions.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No wallet activity matches this account filter.</td></tr> : transactions.map((transaction) => <tr key={transaction.id} className="border-t border-border/60"><td className="num px-4 py-3 text-xs text-muted-foreground">{when(transaction.created_at)}</td><td className="px-4 py-3">{transaction.account_mode === "demo" ? "Demo" : "Real"}</td><td className="px-4 py-3 capitalize">{transaction.kind}</td><td className="px-4 py-3 text-muted-foreground">{transaction.method}</td><td className={cn("num px-4 py-3 text-right font-semibold", transaction.kind === "deposit" ? "text-primary" : "text-destructive")}>{transaction.kind === "deposit" ? "+" : transaction.kind === "withdrawal" ? "minus " : ""}{formatMoney(Number(transaction.amount))} {transaction.account_mode === "demo" ? "USD" : "USDT"}</td></tr>)}</tbody></table></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}