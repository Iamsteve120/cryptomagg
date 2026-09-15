export type TradableAsset = {
  id: string; // CoinGecko id
  symbol: string;
  name: string;
  payoutRate: number; // % return on a winning trade
  fallbackPrice: number;
};

export const ASSETS: TradableAsset[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", payoutRate: 80, fallbackPrice: 64000 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", payoutRate: 78, fallbackPrice: 3200 },
  { id: "solana", symbol: "SOL", name: "Solana", payoutRate: 85, fallbackPrice: 145 },
  { id: "binancecoin", symbol: "BNB", name: "BNB", payoutRate: 75, fallbackPrice: 580 },
  { id: "ripple", symbol: "XRP", name: "XRP", payoutRate: 82, fallbackPrice: 0.55 },
  { id: "cardano", symbol: "ADA", name: "Cardano", payoutRate: 82, fallbackPrice: 0.42 },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", payoutRate: 88, fallbackPrice: 0.13 },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", payoutRate: 85, fallbackPrice: 28 },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", payoutRate: 84, fallbackPrice: 14 },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", payoutRate: 84, fallbackPrice: 6.2 },
];

export const DURATIONS = [
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "1m" },
  { seconds: 300, label: "5m" },
  { seconds: 900, label: "15m" },
];

export const DEPOSIT_METHODS = [
  { id: "usdt-trc20", label: "USDT (TRC-20)", asset: "USDT" },
  { id: "btc", label: "Bitcoin", asset: "BTC" },
  { id: "eth", label: "Ethereum", asset: "ETH" },
  { id: "card", label: "Card (simulated)", asset: "USD" },
];

export const DEMO_ADDRESSES: Record<string, string> = {
  "usdt-trc20": "TDemoMagg9x4Kq7SimulatedAddressOnly",
  btc: "bc1qdemomagg-simulated-address-only",
  eth: "0xDem0Magg000000000000SimulatedOnly",
  card: "simulated-card-checkout",
};

export function assetBySymbol(symbol: string) {
  return ASSETS.find((a) => a.symbol === symbol);
}

export function formatMoney(value: number, digits = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPrice(value: number) {
  if (value >= 100) return formatMoney(value, 2);
  if (value >= 1) return formatMoney(value, 3);
  return formatMoney(value, 5);
}
