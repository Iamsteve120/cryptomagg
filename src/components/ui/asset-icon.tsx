import {
  SiBinance,
  SiBitcoin,
  SiCardano,
  SiChainlink,
  SiDogecoin,
  SiEthereum,
  SiPolkadot,
  SiSolana,
  SiXrp,
} from "@icons-pack/react-simple-icons";
import { CircleDollarSign, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";

const icons: Record<string, typeof SiBitcoin> = {
  BTC: SiBitcoin,
  ETH: SiEthereum,
  SOL: SiSolana,
  BNB: SiBinance,
  XRP: SiXrp,
  ADA: SiCardano,
  DOGE: SiDogecoin,
  LINK: SiChainlink,
  DOT: SiPolkadot,
};

export function AssetIcon({ symbol, className }: { symbol: string; className?: string }) {
  const Icon = icons[symbol];
  if (Icon) return <Icon aria-hidden className={cn("size-5", className)} />;
  if (symbol === "AVAX") return <Mountain aria-hidden className={cn("size-5", className)} />;
  return <CircleDollarSign aria-hidden className={cn("size-5", className)} />;
}