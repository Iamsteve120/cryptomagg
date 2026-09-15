import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import { AssetIcon } from "@/components/ui/asset-icon";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/market-widgets";
import { formatPrice } from "@/lib/assets";
import { cn } from "@/lib/utils";

export interface CryptoCardProps {
  className?: string;
  name: string;
  ticker: string;
  percentageChange: number;
  currentPrice: number;
  payoutRate: number;
  points: number[];
  onTrade: (ticker: string) => void;
}

export function CryptoCard({
  className,
  name,
  ticker,
  percentageChange,
  currentPrice,
  payoutRate,
  points,
  onTrade,
}: CryptoCardProps) {
  const reduceMotion = useReducedMotion();
  const positive = percentageChange >= 0;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.18 }}
      className={cn("overflow-hidden rounded-lg border border-border bg-card shadow-sm", className)}
    >
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-foreground">
            <AssetIcon symbol={ticker} />
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold">{ticker} <span className="font-sans text-xs font-medium text-muted-foreground">USDT</span></p>
            <p className="truncate text-xs text-muted-foreground">{name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="num font-semibold">${formatPrice(currentPrice)}</p>
          <p className={cn("num mt-1 inline-flex items-center gap-1 text-xs font-semibold", positive ? "text-primary" : "text-destructive")}>
            {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(percentageChange).toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="h-14 border-y border-border/60 bg-secondary/20 px-4 py-2">
        <Sparkline points={points} up={positive} />
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Payout</p>
          <p className="num text-sm font-semibold text-primary">{payoutRate}%</p>
        </div>
        <Button size="sm" onClick={() => onTrade(ticker)} aria-label={`Trade ${ticker}`}>
          <ChartNoAxesCombined className="size-4" /> Trade
        </Button>
      </div>
    </motion.article>
  );
}