import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/market-widgets";
import { formatPrice } from "@/lib/assets";
import { cn } from "@/lib/utils";

export interface StockCardProps {
  className?: string;
  ticker: string;
  name: string;
  price: number;
  change: number;
  points: number[];
  payoutRate: number;
  onBuy: (ticker: string) => void;
}

const StockCard = React.forwardRef<HTMLDivElement, StockCardProps>(
  ({ className, ticker, name, price, change, points, payoutRate, onBuy }, ref) => {
    const reduceMotion = useReducedMotion();
    const isPositive = change >= 0;

    return (
      <motion.div
        ref={ref}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={reduceMotion ? undefined : { y: -2 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "grid min-h-32 grid-cols-[1fr_auto] gap-4 rounded-lg border border-border bg-card p-4 shadow-sm",
          className,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 font-display text-sm font-bold text-primary">
            {ticker.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold">{ticker}</p>
            <p className="truncate text-xs text-muted-foreground">{name}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="num font-semibold text-primary">{payoutRate}%</span> payout
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end justify-between gap-3 text-right">
          <div>
            <p className="num font-semibold">${formatPrice(price)}</p>
            <p
              className={cn(
                "num mt-1 inline-flex items-center gap-1 text-xs font-semibold",
                isPositive ? "text-primary" : "text-destructive",
              )}
            >
              {isPositive ? <ArrowUpRight /> : <ArrowDownRight />}
              {Math.abs(change).toFixed(2)}%
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onBuy(ticker)} aria-label={`Trade ${ticker}`}>
            Trade
          </Button>
        </div>

        <div className="col-span-2 flex items-center justify-end border-t border-border/60 pt-3">
          <Sparkline points={points} up={isPositive} />
        </div>
      </motion.div>
    );
  },
);

StockCard.displayName = "StockCard";

export { StockCard };