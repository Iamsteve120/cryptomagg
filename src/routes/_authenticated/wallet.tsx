import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, LockKeyhole, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/market-widgets";
import { useAccount } from "@/hooks/use-trading";
import { moveFunds } from "@/lib/trading.functions";
import { DEMO_ADDRESSES, DEPOSIT_METHODS, formatMoney } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { useAccountMode } from "@/components/account-mode";
import { getUsdKesRate } from "@/lib/market.functions";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { mode } = useAccountMode();
  const queryClient = useQueryClient();
  const { data } = useAccount();
  const move = useServerFn(moveFunds);
  const fetchRate = useServerFn(getUsdKesRate);
  const { data: exchange } = useQuery({
    queryKey: ["usd-kes-rate"],
    queryFn: () => fetchRate(),
    staleTime: 60 * 60 * 1000,
  });

  const [method, setMethod] = useState(DEPOSIT_METHODS[0]!.id);
  const [amount, setAmount] = useState("10");
  const [destination, setDestination] = useState("");

  const balance = data?.profile
    ? Number(mode === "demo" ? data.profile.demo_balance : data.profile.live_balance)
    : 0;
  const deposits = (data?.transactions ?? []).filter((t) => t.kind === "deposit" && t.account_mode === mode);
  const withdrawals = (data?.transactions ?? []).filter((t) => t.kind === "withdrawal" && t.account_mode === mode);
  const usdtAmount = Number(amount) || 0;
  const kesEstimate = exchange?.rate ? usdtAmount * exchange.rate : null;

  const mutation = useMutation({
    mutationFn: (kind: "deposit" | "withdrawal") =>
      move({
        data: {
          kind,
          accountMode: mode,
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
        <h1 className="text-2xl font-semibold">Deposit</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "demo"
            ? "Add simulated funds to practise with CryptoMagg."
            : "Fund your Real account in USDT after payment verification is enabled."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={mode === "demo" ? "Demo balance" : "Real balance"} value={mode === "demo" ? "$" + formatMoney(balance) : formatMoney(balance) + " USDT"} tone="positive" />
        <StatCard
          label="Total deposited"
          value={formatMoney(deposits.reduce((s, t) => s + Number(t.amount), 0)) + (mode === "live" ? " USDT" : " USD")}
        />
        <StatCard
          label="Total withdrawn"
          value={formatMoney(withdrawals.reduce((s, t) => s + Number(t.amount), 0)) + (mode === "live" ? " USDT" : " USD")}
        />
      </div>

      {mode === "live" ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5 rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Smartphone className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">M Pesa deposit</h2>
                <p className="text-sm text-muted-foreground">Choose the USDT amount you want to fund.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quick amount</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[2, 4, 8, 10, 15, 20].map((value) => (
                  <Button key={value} type="button" variant={amount === String(value) ? "default" : "outline"} onClick={() => setAmount(String(value))}>
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="liveAmount">Amount in USDT</Label>
              <Input id="liveAmount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <p className="num text-sm text-muted-foreground">
                {kesEstimate === null
                  ? "KES conversion is temporarily unavailable"
                  : `Estimated KSh ${formatMoney(kesEstimate, 0)}`}
              </p>
            </div>

            <Button className="w-full" disabled>
              <LockKeyhole className="size-4" /> Continue with M Pesa
            </Button>
            <p className="text-xs text-muted-foreground">
              Deposits will open after the payment provider verifies this account. No balance is credited before a signed payment confirmation.
            </p>
          </div>

          <aside className="space-y-4 rounded-lg border border-border bg-card p-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Account name</p>
              <p className="mt-1 font-semibold">CryptoMagg</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Till or paybill</p>
              <p className="mt-1 font-semibold text-muted-foreground">Awaiting provider verification</p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold">Real account protection</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Never send money to a number shown outside this verified deposit screen.
              </p>
            </div>
          </aside>
        </section>
      ) : <Tabs defaultValue="deposit">
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
                    <Button
                      key={m.id}
                      type="button"
                      variant="outline"
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                        method === m.id
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/70 text-muted-foreground hover:bg-accent/60",
                      )}
                    >
                      {m.label}
                    </Button>
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
      </Tabs>}
    </div>
  );
}
