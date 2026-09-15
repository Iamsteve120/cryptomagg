import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/market-widgets";
import { useAccount } from "@/hooks/use-trading";
import { moveFunds } from "@/lib/trading.functions";
import { DEMO_ADDRESSES, DEPOSIT_METHODS, formatMoney } from "@/lib/assets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — CryptoMagg" },
      {
        name: "description",
        content:
          "Simulated deposits and withdrawals for your CryptoMagg demo balance. No real money moves.",
      },
      { property: "og:title", content: "Wallet — CryptoMagg" },
      { property: "og:description", content: "Simulated deposits and withdrawals only." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const queryClient = useQueryClient();
  const { data } = useAccount();
  const move = useServerFn(moveFunds);

  const [method, setMethod] = useState(DEPOSIT_METHODS[0]!.id);
  const [amount, setAmount] = useState("500");
  const [destination, setDestination] = useState("");

  const balance = data?.profile ? Number(data.profile.demo_balance) : 0;
  const deposits = (data?.transactions ?? []).filter((t) => t.kind === "deposit");
  const withdrawals = (data?.transactions ?? []).filter((t) => t.kind === "withdrawal");

  const mutation = useMutation({
    mutationFn: (kind: "deposit" | "withdrawal") =>
      move({
        data: {
          kind,
          method,
          amount: Number(amount) || 0,
          destination: destination || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `Simulated ${res.kind} of $${formatMoney(res.amount)} recorded. New demo balance $${formatMoney(res.balance)}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not complete the simulated transfer."),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Deposits and withdrawals here are simulated. No payment is processed and the addresses
          shown are placeholders.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Demo balance" value={"$" + formatMoney(balance)} tone="positive" />
        <StatCard
          label="Total deposited"
          value={"$" + formatMoney(deposits.reduce((s, t) => s + Number(t.amount), 0))}
        />
        <StatCard
          label="Total withdrawn"
          value={"$" + formatMoney(withdrawals.reduce((s, t) => s + Number(t.amount), 0))}
        />
      </div>

      <Tabs defaultValue="deposit">
        <TabsList>
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DEPOSIT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                        method === m.id
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/70 text-muted-foreground hover:bg-accent/60",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (demo USD)</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("deposit")}
              >
                Simulate deposit
              </Button>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4">
              <p className="text-sm font-semibold">Simulated deposit address</p>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary/60 p-3">
                <code className="num flex-1 break-all text-xs">{DEMO_ADDRESSES[method]}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Copy address"
                  onClick={() => {
                    void navigator.clipboard.writeText(DEMO_ADDRESSES[method] ?? "");
                    toast.success("Placeholder address copied.");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                This address is not real and cannot receive funds. Never send crypto to it. Pressing
                "Simulate deposit" simply credits your demo balance instantly.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="withdraw">
          <div className="max-w-xl space-y-4 rounded-xl border border-border/70 bg-card p-4">
            <div className="space-y-2">
              <Label>Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {DEPOSIT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                      method === m.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border/70 text-muted-foreground hover:bg-accent/60",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">Destination address (not validated)</Label>
              <Input
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Any text — this is a simulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wAmount">Amount (demo USD)</Label>
              <Input
                id="wAmount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <Button
              variant="secondary"
              className="w-full"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("withdrawal")}
            >
              Simulate withdrawal
            </Button>
            <p className="text-xs text-muted-foreground">
              Nothing is sent anywhere. Your demo balance is simply reduced.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
