# Bigger market list, white and green theme, ranking boards

## 1. Expand the tradable market list

Grow the coin list from 10 to the top 30 crypto markets shown on TradingView's
cryptocurrencies page (Bitcoin, Ethereum, Tether, BNB, XRP, Solana, USDC, Dogecoin,
TRON, Cardano, Chainlink, Avalanche, Toncoin, Sui, Polkadot, Litecoin, Bitcoin Cash,
Hedera, Uniswap, Aave, Near, Aptos, Arbitrum, Filecoin, Stellar, Cosmos, Injective,
Render, Lido DAO, Optimism), each with a payout rate and a fallback price.

Live prices, 24h change, high, low and volume keep coming from the same market feed,
so every new coin gets live data and a live candlestick chart.

Stablecoins (Tether, USDC) show in the ranking boards but stay out of the trading
list, since a flat price makes no sense for Up or Down trades.

## 2. Matching coin icons

Each coin gets its real brand mark where one exists in the installed brand icon set.
For coins with no brand mark, a coloured round badge shows the coin's letters in its
own brand colour, so the list still reads like TradingView's rather than showing a
generic placeholder.

## 3. White and green with light and dark mode

- Light mode becomes the default: white surfaces, soft grey lines, the existing
  CryptoMagg green as the accent, green for gains and red for losses.
- Dark mode keeps today's deep green terminal look.
- A sun and moon toggle sits in the top bar on every page and remembers the choice.
- The candlestick chart switches its own theme with the site.
- All colours stay design tokens, so nothing is hardcoded.

## 4. Ranking boards section

New "Market rankings" section on Markets, mirroring the screenshot layout: four
boards in a two by two grid, each row showing coin icon, name, ticker, price, change
and the board's own figure.

- Market cap ranking
- Volume ranking (our data feed has no total value locked figure, so traded volume
  replaces the TVL board)
- Gainers (largest 24h rise, green pill)
- Losers (largest 24h drop, red pill)

Each row opens that coin on the trading terminal. A compact top movers version also
appears on the Dashboard.

## Technical notes

- `src/lib/assets.ts`: expanded `ASSETS`, plus a `tradable` flag for stablecoins.
- `src/components/ui/asset-icon.tsx`: brand icon map plus coloured initials fallback.
- `src/styles.css`: light `:root` tokens (white and green) and `.dark` tokens for the
  current theme; keep `@theme inline` mappings.
- New `src/components/theme-mode.tsx` provider and toggle, persisted in localStorage,
  applied on `<html>` in `__root.tsx` without a hydration mismatch.
- `src/components/candlestick-chart.tsx` takes the active theme.
- New `src/components/market-rankings.tsx` used by `markets.tsx` and `dashboard.tsx`.
- Market data fetches stay server side and unchanged in shape.
