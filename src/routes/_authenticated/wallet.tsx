import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/market-widgets";
import { useAccount } from "@/hooks/use-trading";
import { formatMoney } from "@/lib/assets";
import { useAccountMode } from "@/components/account-mode";
import { getUsdKesRate } from "@/lib/market.functions";
import {
  getFundingActivity,
  getLiveAccountStatus,
  requestMpesaWithdrawal,
  requestWithdrawalCode,
  startMpesaDeposit,
} from "@/lib/payments.functions";
import {
  LIVE_MIN_DEPOSIT,
  LIVE_MIN_WITHDRAWAL,
  USDT_DEPOSIT_ADDRESSES,
  USDT_MIN_DEPOSIT,
} from "@/lib/live-trading";
import { confirmUsdtDeposit, getUsdtDeposits } from "@/lib/crypto-deposits.functions";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet | CryptoMagg" },
      {
        name: "description",
        content:
          "Fund your CryptoMagg account with M Pesa, withdraw to your phone, and review your deposit and withdrawal history.",
      },
      { property: "og:title", content: "Wallet | CryptoMagg" },
      {
        property: "og:description",
        content: "Fund your CryptoMagg account with M Pesa and withdraw to your phone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

const PRESETS = [5, 10, 15, 20, 25, 30, 50, 100];


const STATUS_LABELS: Record<string, string> = {
  pending: "Starting",
  awaiting_user: "Waiting for your PIN",
  completed: "Completed",
  paid: "Completed",
  failed: "Failed",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "paid" || status === "approved"
      ? "bg-primary/15 text-primary"
      : status === "failed" || status === "rejected"
        ? "bg-destructive/15 text-destructive"
        : "bg-secondary text-muted-foreground";
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function UsdtDepositPanel() {
  const queryClient = useQueryClient();
  const confirmDeposit = useServerFn(confirmUsdtDeposit);
  const fetchDeposits = useServerFn(getUsdtDeposits);

  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ["usdt-deposits"],
    queryFn: () => fetchDeposits(),
    refetchInterval: 20_000,
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmDeposit({ data: { txHash: txHash.trim() } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${formatMoney(result.amountUsdt)} USDT added to your balance.`);
      setTxHash("");
      void queryClient.invalidateQueries({ queryKey: ["usdt-deposits"] });
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(address);
      toast.success("Address copied.");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy. Please select the address and copy it manually.");
    }
  }

  return (
    <section className="space-y-5 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Wallet className="size-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Deposit USDT</h2>
          <p className="text-sm text-muted-foreground">
            Send USDT on the Tron network only. Smallest deposit is {USDT_MIN_DEPOSIT} USDT.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {USDT_DEPOSIT_ADDRESSES.map((wallet) => (
          <div key={wallet.address} className="space-y-3 rounded-md border border-border bg-background p-4">
            <div>
              <p className="text-sm font-semibold">{wallet.label}</p>
              <p className="text-xs text-muted-foreground">{wallet.network}</p>
            </div>
            <div className="flex justify-center rounded-md bg-white p-3">
              <QRCodeSVG value={wallet.address} size={148} level="M" />
            </div>
            <p className="num break-all rounded-md bg-secondary px-3 py-2 text-xs">{wallet.address}</p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void copyAddress(wallet.address)}
            >
              {copied === wallet.address ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === wallet.address ? "Copied" : "Copy address"}
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="txHash">Transaction ID from your wallet</Label>
        <Input
          id="txHash"
          placeholder="Paste the transaction ID (hash)"
          value={txHash}
          onChange={(event) => setTxHash(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          After sending, paste the transaction ID here. We check it on the Tron network and add the
          exact amount to your balance. New transfers can take a few minutes to confirm.
        </p>
      </div>
      <Button
        className="w-full"
        disabled={confirmMutation.isPending || txHash.trim().length < 60}
        onClick={() => confirmMutation.mutate()}
      >
        <ArrowDownToLine className="size-4" />
        {confirmMutation.isPending ? "Checking the network" : "Confirm my deposit"}
      </Button>

      <div>
        <p className="text-sm font-semibold">USDT deposits</p>
        <ul className="mt-2 space-y-2 text-sm">
          {(history?.deposits ?? []).map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3">
              <span className="num truncate text-xs text-muted-foreground">
                {row.tx_hash.slice(0, 10)}…
              </span>
              <span className="num">{formatMoney(Number(row.amount_usdt))} USDT</span>
              <StatusPill status={row.status} />
            </li>
          ))}
          {(history?.deposits.length ?? 0) === 0 && (
            <li className="text-muted-foreground">Nothing yet.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

function WalletPage() {
  const { mode } = useAccountMode();
  const { data } = useAccount();
  const queryClient = useQueryClient();

  const fetchRate = useServerFn(getUsdKesRate);
  const fetchStatus = useServerFn(getLiveAccountStatus);
  const fetchFunding = useServerFn(getFundingActivity);
  const deposit = useServerFn(startMpesaDeposit);
  const withdraw = useServerFn(requestMpesaWithdrawal);
  const requestCode = useServerFn(requestWithdrawalCode);

  const { data: exchange } = useQuery({
    queryKey: ["usd-kes-rate"],
    queryFn: () => fetchRate(),
    staleTime: 60 * 60 * 1000,
  });
  const { data: liveStatus } = useQuery({
    queryKey: ["live-account-status"],
    queryFn: () => fetchStatus(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: funding } = useQuery({
    queryKey: ["funding-activity"],
    queryFn: () => fetchFunding(),
    enabled: mode === "live",
    refetchInterval: 5_000,
  });

  const [amount, setAmount] = useState("10");
  const [phone, setPhone] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawCode, setWithdrawCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeSecondsLeft, setCodeSecondsLeft] = useState(0);

  useEffect(() => {
    if (codeSecondsLeft <= 0) return;
    const timer = window.setInterval(() => setCodeSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeSecondsLeft]);

  const balance = data?.profile
    ? Number(mode === "demo" ? data.profile.demo_balance : data.profile.live_balance)
    : 0;
  const usdtAmount = Number(amount) || 0;
  const kesEstimate = exchange?.rate ? usdtAmount * exchange.rate : null;
  const enabled = liveStatus?.enabled === true;

  const depositMutation = useMutation({
    mutationFn: () => deposit({ data: { amountUsdt: usdtAmount, phone } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("M Pesa prompt sent to your phone.");
      void queryClient.invalidateQueries({ queryKey: ["funding-activity"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const codeMutation = useMutation({
    mutationFn: () => requestCode({ data: { amountUsdt: Number(withdrawAmount) || 0, phone: withdrawPhone } }),
    onSuccess: (result) => {
      setCodeSent(true);
      setWithdrawCode("");
      setCodeSecondsLeft(result.expiresInSeconds);
      toast.success(`Confirmation code sent to ${result.sentTo}. It expires in 1 minute.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => withdraw({
      data: { amountUsdt: Number(withdrawAmount) || 0, phone: withdrawPhone, code: withdrawCode },
    }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Withdrawal accepted. Waiting for M Pesa to confirm the payout.");
      setWithdrawAmount("");
      setWithdrawCode("");
      setCodeSent(false);
      setCodeSecondsLeft(0);
      void queryClient.invalidateQueries({ queryKey: ["funding-activity"] });
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "demo"
            ? "Your Demo balance changes only through trades or a full account reset."
            : "Fund your account with M Pesa and withdraw straight to your phone."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={mode === "demo" ? "Demo balance" : "Real balance"}
          value={mode === "demo" ? "$" + formatMoney(balance) : formatMoney(balance) + " USDT"}
          tone="positive"
        />
      </div>

      {mode === "live" ? (
        <>
          {!enabled && (
            <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
              Real money is switched off. Deposits, trades and withdrawals stay unavailable until the
              M Pesa paybill is approved and the account is opened for real trading.
            </p>
          )}

          {enabled && liveStatus?.sandbox === true && (
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
              Test mode. Deposits and withdrawals run on the Safaricom test system, so no real money
              moves and no real phone is charged. Use a Safaricom test number and test PIN to try the
              full flow. Balances credited here are for testing only.
            </p>
          )}

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5 rounded-lg border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold">Deposit with M Pesa</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your number and amount. A PIN prompt is sent to your phone.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quick amount</Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {PRESETS.map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={amount === String(value) ? "default" : "outline"}
                      onClick={() => setAmount(String(value))}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="liveAmount">Amount in USDT</Label>
                  <Input
                    id="liveAmount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <p className="num text-sm text-muted-foreground">
                    {kesEstimate === null
                      ? "Shilling conversion is temporarily unavailable"
                      : `About KSh ${formatMoney(kesEstimate, 0)}`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="livePhone">M Pesa number</Label>
                  <Input
                    id="livePhone"
                    inputMode="tel"
                    placeholder="2547XXXXXXXX"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Use 2547XXXXXXXX, 07XXXXXXXX or 7XXXXXXXX. Smallest deposit is{" "}
                    {LIVE_MIN_DEPOSIT} USDT.
                  </p>
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!enabled || depositMutation.isPending || usdtAmount <= 0 || phone.length < 9}
                onClick={() => depositMutation.mutate()}
              >
                <ArrowDownToLine className="size-4" />
                {depositMutation.isPending ? "Sending prompt" : "Send M Pesa prompt"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Your balance is credited only after Safaricom confirms the payment.
              </p>
            </div>

            <aside className="space-y-4 rounded-lg border border-border bg-card p-5">
              <div>
                <p className="text-sm font-semibold">Trade carefully</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Short term trading loses money for most people. Never stake money you need.
                </p>
              </div>
            </aside>
          </section>

          <UsdtDepositPanel />

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4 rounded-lg border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ArrowUpFromLine className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold">Withdraw to M Pesa</h2>
                  <p className="text-sm text-muted-foreground">
                    M Pesa confirms the payout before it is marked completed.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Available balance</p>
                  <p className="num text-xl font-semibold text-foreground">{formatMoney(balance)} USDT</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={balance < LIVE_MIN_WITHDRAWAL}
                  onClick={() => setWithdrawAmount(String(Math.floor(balance * 100) / 100))}
                >
                  Use available
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="withdrawAmount">Amount in USDT</Label>
                  <Input
                    id="withdrawAmount"
                    inputMode="decimal"
                    placeholder={String(LIVE_MIN_WITHDRAWAL)}
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Smallest withdrawal is {LIVE_MIN_WITHDRAWAL} USDT.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="withdrawPhone">M Pesa number</Label>
                  <Input
                    id="withdrawPhone"
                    inputMode="tel"
                    placeholder="2547XXXXXXXX"
                    value={withdrawPhone}
                    onChange={(event) => setWithdrawPhone(event.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">Enter the phone that should receive the payout.</p>
                </div>
              </div>
              {codeSent ? (
                <div className="space-y-2">
                  <Label htmlFor="withdrawCode">Email confirmation code</Label>
                  <Input
                    id="withdrawCode"
                    autoComplete="one-time-code"
                    placeholder="Enter the 6 character code"
                    value={withdrawCode}
                    onChange={(event) => setWithdrawCode(event.target.value.toUpperCase())}
                  />
                  <p className="text-sm text-muted-foreground">
                    {codeSecondsLeft > 0
                      ? `Code sent to your email. Expires in ${codeSecondsLeft}s. Three tries allowed.`
                      : "That code has expired. Send a new one."}
                  </p>
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={
                    !enabled ||
                    codeMutation.isPending ||
                    (Number(withdrawAmount) || 0) < LIVE_MIN_WITHDRAWAL ||
                    (Number(withdrawAmount) || 0) > balance + 0.001 ||
                    withdrawPhone.replace(/\D/g, "").length < 9
                  }
                  onClick={() => codeMutation.mutate()}
                >
                  {codeMutation.isPending ? "Sending code" : codeSent ? "Send a new code" : "Email me a code"}
                </Button>
                <Button
                  className="w-full"
                  disabled={
                    !enabled ||
                    !codeSent ||
                    codeSecondsLeft <= 0 ||
                    withdrawMutation.isPending ||
                    withdrawCode.trim().length < 4 ||
                    (Number(withdrawAmount) || 0) < LIVE_MIN_WITHDRAWAL ||
                    (Number(withdrawAmount) || 0) > balance + 0.001
                  }
                  onClick={() => withdrawMutation.mutate()}
                >
                  {withdrawMutation.isPending ? "Submitting" : "Confirm withdrawal"}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm font-semibold">Recent funding</p>
              <ul className="mt-3 space-y-2 text-sm">
                {(funding?.deposits ?? []).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Deposit</span>
                    <span className="num">{formatMoney(Number(row.amount_usdt))} USDT</span>
                    <StatusPill status={row.status} />
                  </li>
                ))}
                {(funding?.withdrawals ?? []).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Withdrawal</span>
                    <span className="num">{formatMoney(Number(row.amount_usdt))} USDT</span>
                    <StatusPill status={row.status} />
                  </li>
                ))}
                {(funding?.deposits.length ?? 0) === 0 && (funding?.withdrawals.length ?? 0) === 0 && (
                  <li className="text-muted-foreground">Nothing yet.</li>
                )}
              </ul>
            </div>
          </section>
        </>
      ) : (
        <section className="max-w-2xl rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Demo wallet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Deposits and withdrawals are unavailable in Demo mode. Use your starting balance to
                practise, then reset the full Demo account from Profile when needed.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
