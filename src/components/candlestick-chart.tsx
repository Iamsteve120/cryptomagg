import { useEffect, useRef, useState } from "react";

type Props = {
  symbol: string;
  interval?: "1" | "5" | "15" | "60";
  theme?: "light" | "dark";
  className?: string;
};

/**
 * Live candlestick chart. Streams TradingView's crypto market data
 * (same source as tradingview.com/markets/cryptocurrencies) for the pair.
 */
export function CandlestickChart({ symbol, interval = "1", theme = "dark", className }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    setFailed(false);
    node.innerHTML = "";

    const container = document.createElement("div");
    container.className = "tradingview-widget-container h-full w-full";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget h-full w-full";
    container.appendChild(widget);
    node.appendChild(container);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.onerror = () => setFailed(true);
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${symbol}USDT`,
      interval,
      timezone: "Etc/UTC",
      theme,
      style: "1",
      locale: "en",
      hide_top_toolbar: true,
      hide_legend: false,
      hide_side_toolbar: true,
      allow_symbol_change: false,
      save_image: false,
      backgroundColor: theme === "dark" ? "rgba(10, 14, 12, 1)" : "rgba(255, 255, 255, 1)",
      gridColor: theme === "dark" ? "rgba(120, 140, 130, 0.12)" : "rgba(120, 140, 130, 0.16)",
      withdateranges: false,
      details: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      node.innerHTML = "";
    };
  }, [symbol, interval, theme]);

  return (
    <div className={className}>
      <div ref={holder} className="h-full w-full overflow-hidden rounded-md" />
      {failed ? (
        <p className="p-3 text-xs text-muted-foreground">Candles are temporarily unavailable. Live prices continue to update.</p>
      ) : null}
    </div>
  );
}
