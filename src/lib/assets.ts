export type TradableAsset = {
  id: string; // CoinGecko id
  symbol: string;
  name: string;
  payoutRate: number; // % return on a winning trade
  fallbackPrice: number;
  brandColor: string; // used by the icon badge when no brand mark exists
  tradable?: boolean; // stablecoins are listed but not tradable
};

export const ASSETS: TradableAsset[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", payoutRate: 80, fallbackPrice: 64000, brandColor: "#f7931a" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", payoutRate: 78, fallbackPrice: 3200, brandColor: "#627eea" },
  { id: "tether", symbol: "USDT", name: "Tether USDt", payoutRate: 70, fallbackPrice: 1, brandColor: "#26a17b", tradable: false },
  { id: "binancecoin", symbol: "BNB", name: "BNB", payoutRate: 75, fallbackPrice: 580, brandColor: "#f3ba2f" },
  { id: "ripple", symbol: "XRP", name: "XRP", payoutRate: 82, fallbackPrice: 0.55, brandColor: "#23292f" },
  { id: "solana", symbol: "SOL", name: "Solana", payoutRate: 85, fallbackPrice: 145, brandColor: "#14f195" },
  { id: "usd-coin", symbol: "USDC", name: "USDC", payoutRate: 70, fallbackPrice: 1, brandColor: "#2775ca", tradable: false },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", payoutRate: 88, fallbackPrice: 0.13, brandColor: "#c2a633" },
  { id: "tron", symbol: "TRX", name: "TRON", payoutRate: 82, fallbackPrice: 0.16, brandColor: "#eb0029" },
  { id: "cardano", symbol: "ADA", name: "Cardano", payoutRate: 82, fallbackPrice: 0.42, brandColor: "#0033ad" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", payoutRate: 84, fallbackPrice: 14, brandColor: "#2a5ada" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", payoutRate: 85, fallbackPrice: 28, brandColor: "#e84142" },
  { id: "the-open-network", symbol: "TON", name: "Toncoin", payoutRate: 84, fallbackPrice: 2.4, brandColor: "#0098ea" },
  { id: "sui", symbol: "SUI", name: "Sui", payoutRate: 86, fallbackPrice: 1.9, brandColor: "#4da2ff" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", payoutRate: 84, fallbackPrice: 6.2, brandColor: "#e6007a" },
  { id: "litecoin", symbol: "LTC", name: "Litecoin", payoutRate: 80, fallbackPrice: 88, brandColor: "#345d9d" },
  { id: "bitcoin-cash", symbol: "BCH", name: "Bitcoin Cash", payoutRate: 80, fallbackPrice: 420, brandColor: "#0ac18e" },
  { id: "hedera-hashgraph", symbol: "HBAR", name: "Hedera", payoutRate: 85, fallbackPrice: 0.19, brandColor: "#222222" },
  { id: "uniswap", symbol: "UNI", name: "Uniswap", payoutRate: 85, fallbackPrice: 6.4, brandColor: "#ff007a" },
  { id: "aave", symbol: "AAVE", name: "Aave", payoutRate: 85, fallbackPrice: 121, brandColor: "#b6509e" },
  { id: "near", symbol: "NEAR", name: "NEAR Protocol", payoutRate: 86, fallbackPrice: 2.3, brandColor: "#00c1de" },
  { id: "aptos", symbol: "APT", name: "Aptos", payoutRate: 86, fallbackPrice: 4.1, brandColor: "#06b6d4" },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum", payoutRate: 87, fallbackPrice: 0.15, brandColor: "#12aaff" },
  { id: "filecoin", symbol: "FIL", name: "Filecoin", payoutRate: 86, fallbackPrice: 0.8, brandColor: "#0090ff" },
  { id: "stellar", symbol: "XLM", name: "Stellar", payoutRate: 84, fallbackPrice: 0.3, brandColor: "#7d00ff" },
  { id: "cosmos", symbol: "ATOM", name: "Cosmos", payoutRate: 85, fallbackPrice: 3.9, brandColor: "#2e3148" },
  { id: "injective-protocol", symbol: "INJ", name: "Injective", payoutRate: 87, fallbackPrice: 5.4, brandColor: "#0f7bff" },
  { id: "render-token", symbol: "RENDER", name: "Render", payoutRate: 87, fallbackPrice: 2.1, brandColor: "#ff4a3d" },
  { id: "lido-dao", symbol: "LDO", name: "Lido DAO", payoutRate: 87, fallbackPrice: 0.33, brandColor: "#f69988" },
  { id: "optimism", symbol: "OP", name: "Optimism", payoutRate: 87, fallbackPrice: 0.42, brandColor: "#ff0420" },
];

export const TRADABLE_ASSETS = ASSETS.filter((a) => a.tradable !== false);

export const DURATIONS = [
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "1m" },
  { seconds: 300, label: "5m" },
  { seconds: 900, label: "15m" },
];

export const DEPOSIT_METHODS = [
  { id: "usdt-trc20", label: "USDT (TRC 20)", asset: "USDT" },
  { id: "btc", label: "Bitcoin", asset: "BTC" },
  { id: "eth", label: "Ethereum", asset: "ETH" },
  { id: "card", label: "Card (simulated)", asset: "USD" },
];

export const DEMO_ADDRESSES: Record<string, string> = {
  "usdt-trc20": "TDemoMagg9x4Kq7SimulatedAddressOnly",
  btc: "bc1qdemomagg simulated address only",
  eth: "0xDem0Magg000000000000SimulatedOnly",
  card: "simulated card checkout",
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

export function formatCompactUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Unavailable";
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)} T`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M`;
  return formatMoney(value, 0);
}
