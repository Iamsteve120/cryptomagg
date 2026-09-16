import {
  SiBinance,
  SiBitcoin,
  SiBitcoincash,
  SiCardano,
  SiChainlink,
  SiDogecoin,
  SiEthereum,
  SiHedera,
  SiLitecoin,
  SiNear,
  SiOptimism,
  SiPolkadot,
  SiRender,
  SiSolana,
  SiStellar,
  SiSui,
  SiTether,
  SiTon,
  SiXrp,
} from "@icons-pack/react-simple-icons";
import { assetBySymbol } from "@/lib/assets";
import { cn } from "@/lib/utils";

const icons: Record<string, typeof SiBitcoin> = {
  BTC: SiBitcoin,
  ETH: SiEthereum,
  USDT: SiTether,
  BNB: SiBinance,
  XRP: SiXrp,
  SOL: SiSolana,
  DOGE: SiDogecoin,
  ADA: SiCardano,
  LINK: SiChainlink,
  TON: SiTon,
  SUI: SiSui,
  DOT: SiPolkadot,
  LTC: SiLitecoin,
  BCH: SiBitcoincash,
  HBAR: SiHedera,
  NEAR: SiNear,
  RENDER: SiRender,
  XLM: SiStellar,
  OP: SiOptimism,
};

/** Short letters used on the coloured badge when a brand mark is unavailable. */
function initials(symbol: string) {
  return symbol.slice(0, symbol.length > 4 ? 3 : 2);
}

export function AssetIcon({ symbol, className }: { symbol: string; className?: string }) {
  const color = assetBySymbol(symbol)?.brandColor ?? "#7c8b84";
  const Icon = icons[symbol];
  if (Icon) return <Icon aria-hidden style={{ color }} className={cn("size-5", className)} />;
  return (
    <span
      aria-hidden
      style={{ backgroundColor: color }}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold uppercase leading-none tracking-tight text-white",
        className,
      )}
    >
      {initials(symbol)}
    </span>
  );
}
