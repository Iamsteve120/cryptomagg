import { useEffect, useRef } from "react";
import { syntheticCandles } from "@/lib/synthetic";

type Props = {
  symbol: string;
  /** Candle length in minutes, matching the chart interval buttons. */
  interval?: "1" | "5" | "15" | "60";
  theme?: "light" | "dark";
  className?: string;
};

const COUNT = 70;

/**
 * Candlestick chart for the generated crypto instruments. It draws the same
 * series the trades settle on, recomputed from the clock on every frame, so
 * what a trader sees is exactly what a trade closes against.
 */
export function SyntheticChart({ symbol, interval = "1", theme = "dark", className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;

    const up = "#22c55e";
    const down = "#ef4444";
    const grid = theme === "dark" ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.16)";
    const text = theme === "dark" ? "rgba(226,232,240,0.7)" : "rgba(51,65,85,0.75)";

    const draw = () => {
      const parent = canvas.parentElement;
      const ratio = window.devicePixelRatio || 1;
      const width = parent?.clientWidth ?? 320;
      const height = parent?.clientHeight ?? 240;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const candles = syntheticCandles(symbol, Number(interval) * 60, COUNT);
      const highs = candles.map((candle) => candle.high);
      const lows = candles.map((candle) => candle.low);
      const top = Math.max(...highs);
      const bottom = Math.min(...lows);
      const span = top - bottom || top * 0.001;
      const padTop = 10;
      const padBottom = 18;
      const padRight = 58;
      const plotHeight = height - padTop - padBottom;
      const plotWidth = width - padRight - 4;
      const y = (price: number) => padTop + ((top - price) / span) * plotHeight;

      context.font = "10px ui-monospace, monospace";
      context.fillStyle = text;
      context.strokeStyle = grid;
      context.lineWidth = 1;
      for (let line = 0; line <= 4; line += 1) {
        const price = bottom + (span * line) / 4;
        const lineY = Math.round(y(price)) + 0.5;
        context.beginPath();
        context.moveTo(0, lineY);
        context.lineTo(plotWidth, lineY);
        context.stroke();
        context.fillText(price.toFixed(price < 10 ? 4 : 2), plotWidth + 6, lineY + 3);
      }

      const slot = plotWidth / candles.length;
      const body = Math.max(1.5, slot * 0.6);
      candles.forEach((candle, index) => {
        const centre = index * slot + slot / 2;
        const rising = candle.close >= candle.open;
        context.strokeStyle = rising ? up : down;
        context.fillStyle = rising ? up : down;
        context.beginPath();
        context.moveTo(centre, y(candle.high));
        context.lineTo(centre, y(candle.low));
        context.stroke();
        const openY = y(candle.open);
        const closeY = y(candle.close);
        const barTop = Math.min(openY, closeY);
        context.fillRect(centre - body / 2, barTop, body, Math.max(1, Math.abs(closeY - openY)));
      });

      const last = candles[candles.length - 1];
      if (last) {
        const lastY = y(last.close);
        context.strokeStyle = last.close >= last.open ? up : down;
        context.setLineDash([4, 3]);
        context.beginPath();
        context.moveTo(0, lastY);
        context.lineTo(plotWidth, lastY);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = last.close >= last.open ? up : down;
        context.fillRect(plotWidth + 2, lastY - 8, padRight - 4, 16);
        context.fillStyle = "#ffffff";
        context.fillText(last.close.toFixed(last.close < 10 ? 4 : 2), plotWidth + 6, lastY + 3);
      }

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [symbol, interval, theme]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
