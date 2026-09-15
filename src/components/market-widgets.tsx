import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/assets";

export function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (!points || points.length < 2) {
    return <div className="h-8 w-24 rounded bg-muted/60" aria-hidden />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 30 - ((p - min) / span) * 28;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 30" className="h-8 w-24 overflow-visible" preserveAspectRatio="none">
      <path
        d={path}
        fill="none"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        className={up ? "stroke-primary" : "stroke-destructive"}
      />
    </svg>
  );
}

export function ChangeBadge({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
        up ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
      )}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

export function PriceText({ value }: { value: number }) {
  return <span className="num font-semibold">${formatPrice(value)}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num mt-1 text-2xl font-semibold",
          tone === "positive" && "text-primary",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
