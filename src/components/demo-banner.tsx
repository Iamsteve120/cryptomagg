import { TriangleAlert } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="border-b border-primary/25 bg-primary/10">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-[11px] font-medium tracking-wide text-primary sm:text-xs">
        <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
        <span>CryptoMagg is a demo trading simulator. No real money is involved.</span>
      </div>
    </div>
  );
}

export function DemoFooter() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-8 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">CryptoMagg · cryptomagg.site</p>
        <p className="mt-2 max-w-2xl leading-relaxed">
          CryptoMagg is a demo trading simulator. No real money is involved. Deposits, withdrawals,
          wallet addresses and balances are simulated for practice only. Market prices are sourced
          from a public feed and shown for realism.
        </p>
      </div>
    </footer>
  );
}
