import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccount } from "@/hooks/use-trading";
import { formatMoney, formatPrice } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { useAccountMode } from "@/components/account-mode";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History — CryptoMagg" },
      {
        name: "description",
        content: "Full record of your simulated CryptoMagg trades, deposits and withdrawals.",
      },
      { property: "og:title", content: "History — CryptoMagg" },
      { property: "og:description", content: "Your simulated trade and wallet history." },
    ],
  }),
  component: HistoryPage,
});

function when(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistoryPage() {
  const { mode } = useAccountMode();
  const { data } = useAccount();
  const trades = (data?.trades ?? []).filter((trade) => trade.account_mode === mode);
  const transactions = (data?.transactions ?? []).filter((transaction) => transaction.account_mode === mode);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "demo" ? "Your demo account activity." : "Your verified Live account activity."}
        </p>
      </div>

      <Tabs defaultValue="trades">
        <TabsList>
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
        </TabsList>

        <TabsContent value="trades">
          <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Opened</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Stake</th>
                  <th className="px-4 py-3">Entry / Exit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">P/L</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No trades yet.
                    </td>
                  </tr>
                ) : (
                  trades.map((t) => (
                    <tr key={t.id} className="border-t border-border/60">
                      <td className="num px-4 py-3 text-xs text-muted-foreground">
                        {when(t.created_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold">{t.symbol}</td>
                      <td
                        className={cn(
                          "px-4 py-3 font-medium",
                          t.direction === "up" ? "text-primary" : "text-destructive",
                        )}
                      >
                        {t.direction === "up" ? "▲ Up" : "▼ Down"}
                      </td>
                      <td className="num px-4 py-3">${formatMoney(Number(t.stake))}</td>
                      <td className="num px-4 py-3 text-xs text-muted-foreground">
                        ${formatPrice(Number(t.entry_price))} →{" "}
                        {t.exit_price ? "$" + formatPrice(Number(t.exit_price)) : "—"}
                      </td>
                      <td className="px-4 py-3 capitalize">{t.status}</td>
                      <td
                        className={cn(
                          "num px-4 py-3 text-right font-semibold",
                          Number(t.pnl) > 0 && "text-primary",
                          Number(t.pnl) < 0 && "text-destructive",
                        )}
                      >
                        {Number(t.pnl) > 0 ? "+" : Number(t.pnl) < 0 ? "-" : ""}$
                        {formatMoney(Math.abs(Number(t.pnl)))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="wallet">
          <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No deposits or withdrawals yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-border/60">
                      <td className="num px-4 py-3 text-xs text-muted-foreground">
                        {when(tx.created_at)}
                      </td>
                      <td className="px-4 py-3 capitalize">{tx.kind}</td>
                      <td className="px-4 py-3 text-muted-foreground">{tx.method}</td>
                      <td className="px-4 py-3 capitalize">{tx.status}</td>
                      <td
                        className={cn(
                          "num px-4 py-3 text-right font-semibold",
                          tx.kind === "deposit" ? "text-primary" : "text-destructive",
                        )}
                      >
                        {tx.kind === "deposit" ? "+" : "-"}${formatMoney(Number(tx.amount))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
