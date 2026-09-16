import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, LoaderCircle, Radar, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AssetIcon } from "@/components/ui/asset-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scanMarkets } from "@/lib/scanner.functions";
import { formatPrice } from "@/lib/assets";
import { cn } from "@/lib/utils";
import type { AccountMode } from "@/components/account-mode";

type ScanResult = Awaited<ReturnType<typeof scanMarkets>>;
type MarketOption = ScanResult["options"][number];

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
  const [picked, setPicked] = useState<string | null>(null);
  const [stake, setStake] = useState("25");
  const scanMutation = useMutation({
    mutationFn: () => scan(),
    onSuccess: (data) => {
      setResult(data);
      setPicked(data.symbol);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "The market scan could not be completed."),
  });

  const stakeValue = Number(stake) || 0;
  const options: MarketOption[] = result?.options ?? [];
  const active: { symbol: string; direction: "up" | "down" | "wait"; confidence: number; durationSeconds: number } | null = result
    ? picked && picked !== result.symbol
      ? options.find((item) => item.symbol === picked) ?? null
      : { symbol: result.symbol, direction: result.direction, confidence: result.confidence, durationSeconds: result.durationSeconds }
    : null;
  const isTop = Boolean(result && active && active.symbol === result.symbol);
  const canExecute = mode === "demo" && Boolean(active) && active?.direction !== "wait" && stakeValue >= 2 && stakeValue <= 500 && stakeValue <= balance && !busy;

  function executeResult() {
    if (!active || active.direction === "wait") return;
    onExecute({ symbol: active.symbol, direction: active.direction, durationSeconds: active.durationSeconds, stake: stakeValue });
    setOpen(false);
  }

  return (
    <>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-24 right-4 z-40 lg:bottom-7 lg:right-7"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open AI market scanner"
          className="relative flex size-16 items-center justify-center rounded-full border-4 border-card bg-primary font-display text-xl font-bold tracking-tight text-primary-foreground shadow-xl transition hover:scale-105"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
          <span className="relative">AI</span>
          <span className="absolute right-1.5 top-1.5 size-3 rounded-full border-2 border-background bg-primary" />
        </button>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl gap-0 overflow-y-auto rounded-lg border-primary/30 bg-card p-0 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)]">
          <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-4 py-4 text-left sm:px-5 sm:py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">AI</div>
              <div><DialogTitle>Entry scanner</DialogTitle><DialogDescription>AI analysis across every supported market</DialogDescription></div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
            {!result && !scanMutation.isPending ? (
              <div className="space-y-4 py-2">
                <div className="rounded-md border border-border bg-secondary/25 p-4"><p className="font-medium">Scan all supported markets</p><p className="mt-1 text-sm text-muted-foreground">Compares momentum, daily range, direction, and liquidity, then ranks every market so you can pick your own setup.</p></div>
                <Button className="w-full" onClick={() => scanMutation.mutate()}><Radar className="size-4" /> Scan markets</Button>
              </div>
            ) : null}

            {scanMutation.isPending ? (
              <div className="py-10 text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-primary" /><p className="mt-4 font-semibold">Analyzing live markets</p><p className="mt-1 text-sm text-muted-foreground">Comparing price action and liquidity across every supported asset.</p><div className="mx-auto mt-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-secondary"><motion.div className="h-full bg-primary" initial={{ width: "8%" }} animate={{ width: "86%" }} transition={{ duration: 12, ease: "easeOut" }} /></div></div>
            ) : null}

            {result && active && !scanMutation.isPending ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/25 p-4">
                  <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-full bg-secondary"><AssetIcon symbol={active.symbol} /></div><div><p className="font-semibold">{active.symbol} / USD</p><p className="text-xs text-muted-foreground">{result.marketsScanned} markets scanned {isTop ? "| top ranked setup" : "| your selection"}</p></div></div>
                  <div className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold", active.direction === "up" ? "bg-primary/15 text-primary" : active.direction === "down" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground")}>{active.direction === "up" ? <ArrowUpRight className="size-4" /> : active.direction === "down" ? <ArrowDownRight className="size-4" /> : <ChartNoAxesCombined className="size-4" />}{active.direction === "wait" ? "Wait" : active.direction === "up" ? "Up" : "Down"}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Confidence</p><p className="num mt-1 text-lg font-semibold">{active.confidence}%</p></div>
                  <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Expiry</p><p className="num mt-1 text-lg font-semibold">{active.durationSeconds < 60 ? `${active.durationSeconds}s` : `${active.durationSeconds / 60}m`}</p></div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">All market options</p>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1 sm:max-h-64">
                    {options.map((item) => (
                      <li key={item.symbol}>
                        <button
                          type="button"
                          onClick={() => setPicked(item.symbol)}
                          className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3 text-left transition", picked === item.symbol ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/40")}
                        >
                           <span className="flex min-w-0 items-center gap-3">
                            <AssetIcon symbol={item.symbol} className="size-5" />
                            <span>
                              <span className="block text-sm font-semibold">{item.symbol}</span>
                               <span className="num block truncate text-xs text-muted-foreground">${formatPrice(item.price)}</span>
                            </span>
                          </span>
                          <span className="text-right">
                            <span className={cn("block text-xs font-semibold", item.direction === "up" ? "text-primary" : item.direction === "down" ? "text-destructive" : "text-muted-foreground")}>{item.direction === "up" ? "Up" : item.direction === "down" ? "Down" : "Wait"}</span>
                            <span className="num block text-xs text-muted-foreground">{item.confidence}% | {item.durationSeconds < 60 ? `${item.durationSeconds}s` : `${item.durationSeconds / 60}m`}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Market condition</p><p className="mt-1 text-sm">{result.marketCondition}</p></div>
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Why this setup</p><p className="mt-1 text-sm leading-6">{result.rationale}</p></div>
                <div className="rounded-md border border-border bg-secondary/25 p-3 text-sm text-muted-foreground"><ShieldCheck className="mr-2 inline size-4 text-primary" />{result.riskNote}</div>

                <div><Label htmlFor="scannerStake">Demo stake</Label><Input id="scannerStake" className="mt-2" type="number" inputMode="decimal" min="2" max="500" step="1" value={stake} onChange={(event) => setStake(event.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Minimum 2 USD | Maximum 500 USD | Available {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p></div>
                <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}><Radar className="size-4" /> Scan again</Button><Button className="min-h-10 whitespace-normal" disabled={!canExecute} onClick={executeResult}><ChartNoAxesCombined className="size-4 shrink-0" />{mode === "live" ? "Demo scanner only" : `Place Demo trade on ${active.symbol}`}</Button></div>
              </div>
            ) : null}
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">Scanner confidence is a simulated score from 80% to 87%. Demo outcomes target a simulated 95 percent practice win rate and still include losses. This is not financial advice or a real market promise.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
