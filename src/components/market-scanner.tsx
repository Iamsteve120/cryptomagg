import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, LoaderCircle, LockKeyhole, Radar, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AssetIcon } from "@/components/ui/asset-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scanMarkets } from "@/lib/scanner.functions";
import { cn } from "@/lib/utils";
import type { AccountMode } from "@/components/account-mode";

type ScanResult = Awaited<ReturnType<typeof scanMarkets>>;

type MarketScannerProps = {
  mode: AccountMode;
  balance: number;
  busy: boolean;
  onExecute: (setup: { symbol: string; direction: "up" | "down"; durationSeconds: number; stake: number }) => void;
};

export function MarketScanner({ mode, balance, busy, onExecute }: MarketScannerProps) {
  const scan = useServerFn(scanMarkets);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [stake, setStake] = useState("25");
  const scanMutation = useMutation({
    mutationFn: () => scan(),
    onSuccess: setResult,
    onError: (error) => toast.error(error instanceof Error ? error.message : "The market scan could not be completed."),
  });
  const stakeValue = Number(stake) || 0;
  const canExecute = mode === "demo" && Boolean(result) && result?.direction !== "wait" && stakeValue >= 2 && stakeValue <= balance && !busy;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
  }

  function executeResult() {
    if (!result || result.direction === "wait") return;
    onExecute({ symbol: result.symbol, direction: result.direction, durationSeconds: result.durationSeconds, stake: stakeValue });
    setOpen(false);
  }

  return (
    <>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed bottom-24 right-4 z-40 lg:bottom-7 lg:right-7">
        <Button onClick={() => setOpen(true)} className="h-12 gap-2 border border-primary/40 shadow-lg" aria-label="Open market scanner">
          <Radar className="size-5" /> <span>Market scanner</span>
        </Button>
      </motion.div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg border-primary/30 bg-card p-0">
          <DialogHeader className="border-b border-border bg-secondary/40 px-5 py-5 text-left">
            <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary"><Radar className="size-5" /></div><div><DialogTitle>Market scanner</DialogTitle><DialogDescription>AI analysis for Demo trading</DialogDescription></div></div>
          </DialogHeader>

          <div className="space-y-4 px-5 pb-5">
            {!result && !scanMutation.isPending ? (
              <div className="space-y-4 py-2">
                <div className="rounded-md border border-border bg-secondary/25 p-4"><p className="font-medium">Scan all supported markets</p><p className="mt-1 text-sm text-muted-foreground">Compares momentum, daily range, direction, and liquidity to find one clear simulated setup.</p></div>
                <Button className="w-full" onClick={() => scanMutation.mutate()}><Radar className="size-4" /> Scan markets</Button>
              </div>
            ) : null}

            {scanMutation.isPending ? (
              <div className="py-10 text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-primary" /><p className="mt-4 font-semibold">Analyzing live markets</p><p className="mt-1 text-sm text-muted-foreground">Comparing price action and liquidity across every supported asset.</p><div className="mx-auto mt-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-secondary"><motion.div className="h-full bg-primary" initial={{ width: "8%" }} animate={{ width: "86%" }} transition={{ duration: 12, ease: "easeOut" }} /></div></div>
            ) : null}

            {result && !scanMutation.isPending ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/25 p-4">
                  <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-full bg-secondary"><AssetIcon symbol={result.symbol} /></div><div><p className="font-semibold">{result.symbol} / USD</p><p className="text-xs text-muted-foreground">{result.marketsScanned} markets scanned</p></div></div>
                  <div className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold", result.direction === "up" ? "bg-primary/15 text-primary" : result.direction === "down" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground")}>{result.direction === "up" ? <ArrowUpRight className="size-4" /> : result.direction === "down" ? <ArrowDownRight className="size-4" /> : <ChartNoAxesCombined className="size-4" />}{result.direction === "wait" ? "Wait" : result.direction === "up" ? "Up" : "Down"}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Confidence</p><p className="num mt-1 text-lg font-semibold">{result.confidence}%</p></div>
                  <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Expiry</p><p className="num mt-1 text-lg font-semibold">{result.durationSeconds < 60 ? `${result.durationSeconds}s` : `${result.durationSeconds / 60}m`}</p></div>
                </div>
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Market condition</p><p className="mt-1 text-sm">{result.marketCondition}</p></div>
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Why this setup</p><p className="mt-1 text-sm leading-6">{result.rationale}</p></div>
                <div className="rounded-md border border-border bg-secondary/25 p-3 text-sm text-muted-foreground"><ShieldCheck className="mr-2 inline size-4 text-primary" />{result.riskNote}</div>

                <div><Label htmlFor="scannerStake">Demo stake</Label><Input id="scannerStake" className="mt-2" inputMode="decimal" value={stake} onChange={(event) => setStake(event.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Available: {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p></div>
                <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}><Radar className="size-4" /> Scan again</Button><Button disabled={!canExecute} onClick={executeResult}>{mode === "live" ? <LockKeyhole className="size-4" /> : <ChartNoAxesCombined className="size-4" />}{mode === "live" ? "Real trading locked" : result.direction === "wait" ? "No trade suggested" : "Place Demo trade"}</Button></div>
              </div>
            ) : null}
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">Scanner output is educational analysis for simulated trading. It is not financial advice and cannot predict future prices.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}