import { BrandLogo } from "@/components/brand-logo";

export function DemoFooter() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-8 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo size="sm" withWordmark={false} />
          <p className="truncate font-semibold text-foreground">CryptoMagg | cryptomagg.site</p>
        </div>
        <p className="mt-3 max-w-2xl leading-relaxed text-primary">
          Crypto trading carries a high level of risk. Prices move fast and most short-term traders
          lose money, so only trade with funds you can afford to lose.
        </p>
      </div>
    </footer>
  );
}
