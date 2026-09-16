import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/market-widgets";
import { useAccount } from "@/hooks/use-trading";
import { formatMoney } from "@/lib/assets";
import { useAccountMode } from "@/components/account-mode";
import { getUsdKesRate } from "@/lib/market.functions";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet | CryptoMagg" },
      {
        name: "description",
        content:
          "View your CryptoMagg Demo balance. Demo deposits and withdrawals are unavailable.",
      },
      { property: "og:title", content: "Wallet | CryptoMagg" },
      { property: "og:description", content: "View your CryptoMagg Demo and Real account balances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { mode } = useAccountMode();
  const { data } = useAccount();
  const fetchRate = useServerFn(getUsdKesRate);
  const { data: exchange } = useQuery({
    queryKey: ["usd-kes-rate"],
    queryFn: () => fetchRate(),
    staleTime: 60 * 60 * 1000,
  });

  const [amount, setAmount] = useState("10");

  const balance = data?.profile
    ? Number(mode === "demo" ? data.profile.demo_balance : data.profile.live_balance)
    : 0;
  const usdtAmount = Number(amount) || 0;
  const kesEstimate = exchange?.rate ? usdtAmount * exchange.rate : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "demo"
            ? "Your Demo balance changes only through trades or a full account reset."
            : "Fund your Real account in USDT after payment verification is enabled."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={mode === "demo" ? "Demo balance" : "Real balance"} value={mode === "demo" ? "$" + formatMoney(balance) : formatMoney(balance) + " USDT"} tone="positive" />
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
      ) : <section className="max-w-2xl rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><ShieldCheck className="size-5" /></div>
          <div><h2 className="font-display text-lg font-semibold">Demo wallet</h2><p className="mt-1 text-sm text-muted-foreground">Deposits and withdrawals are unavailable in Demo mode. Use your starting balance to practise, then reset the full Demo account from Profile when needed.</p></div>
        </div>
      </section>}
    </div>
  );
}
