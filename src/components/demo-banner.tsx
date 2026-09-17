import { ShieldAlert } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export function DemoFooter() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-8 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" withWordmark={false} />
          <p className="font-semibold text-foreground">CryptoMagg | cryptomagg.site</p>
        </div>
        <p className="mt-3 max-w-2xl leading-relaxed">
          Trade crypto the simple way. Fund your account instantly via M-Pesa STK push, place your
          trades on markets we operate and settle, and withdraw your balance whenever you request it.
          We process every deposit and withdrawal, and the market you trade on is managed by CryptoMagg.
        </p>
        <p className="mt-3 flex items-start gap-2 leading-relaxed text-primary">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Crypto trading carries a high level of risk. Prices move fast and most short-term traders
          lose money, so only trade with funds you can afford to lose.
        </p>
      </div>
    </footer>
  );
}
