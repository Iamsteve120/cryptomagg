# CryptoMagg trading experience upgrade

## Overview

Refresh the product so it feels like a focused trading platform rather than a template. Keep Real money actions locked until a verified provider is connected. Expand Demo mode with clear market signals and optional trader controlled automation, and make every trade auditable through its balance impact.

## Interface and wording

- Remove all visible hyphens, en dashes, and em dashes from page copy, labels, notifications, empty states, metadata titles, and technical labels where a clear alternative exists.
- Remove “without risking a cent” from the landing page and rewrite the surrounding sentence cleanly.
- Replace initials and generic lightning or AI looking symbols with recognizable local cryptocurrency brand icons and familiar trading icons.
- Integrate a completed `CryptoCard` in the existing `src/components/ui` design system, using semantic colors, existing typography, motion preferences, and real local asset marks.
- Use the new card consistently on Dashboard and Markets, with clear price, movement, payout, chart, and Trade actions.
- Tighten navigation, spacing, hierarchy, mobile behavior, and empty states without adding decorative AI effects or generic template styling.

## Trading and account behavior

- Keep Real deposits and Real trading unavailable until a verified payment provider and account verification are present.
- Keep manual Demo trading fully available and clearly distinguish Demo balances from Real USDT balances.
- Add a Trade Assist area that produces explainable Up, Down, or Wait signals from current market data. Show confidence, supporting indicators, timestamp, and a clear simulation disclaimer.
- Require the trader to confirm assisted trades manually.
- Add optional Demo auto trading with explicit opt in, asset, stake, expiry, confidence threshold, maximum trades, and maximum session loss controls.
- Auto trading stops when the page closes, the trader disables it, a limit is reached, the balance is insufficient, or market data is stale. It never runs on Real accounts.
- Record whether each Demo trade was placed manually, from an assisted signal, or through Demo auto trading.

## History and balance audit

- Record balance before opening, balance immediately after the stake is reserved, and balance after settlement for every new trade.
- Make opening and settlement updates atomic so concurrent requests cannot overspend, double credit, or lose balance updates.
- Show both Demo and Real trades in History with a clear account label, while retaining an account filter.
- Add status, source, opening balance, stake, result, and resulting balance to the trade history view. A trade that leaves the Demo balance at 9,890 USD will display exactly 9,890 USD.
- Keep existing historical rows readable with an “Unavailable” balance value where no reliable snapshot exists.
- Refresh account and history data immediately after trade opening and settlement.

## Technical details

- Add trade snapshot and source fields through a Lovable Cloud migration, with narrow grants and existing owner scoped read policies preserved.
- Add authenticated database functions for atomic trade reservation and settlement balance updates. Validate ownership and account mode server side.
- Keep server validation and rate limits on trade actions. Add dedicated limits for signal generation and automated placement.
- Derive Trade Assist signals from live quote trend data with transparent deterministic scoring. Do not claim guaranteed outcomes or financial advice.
- Use the existing TanStack Start structure, shadcn components, Tailwind tokens, TypeScript, Lucide controls, and Framer Motion with reduced motion support.
- Update generated database types after the migration.

## Verification

- Test manual Demo trades, assisted Demo trades, and controlled Demo auto trading from placement through settlement and history.
- Verify exact balance snapshots for wins, losses, ties, and insufficient balance attempts.
- Verify Real trading remains blocked on both the screen and server.
- Check Dashboard, Markets, Trade, History, Wallet, Profile, authentication, and landing pages for visible dash punctuation.
- Check desktop and mobile layouts for overflow, overlap, readable icons, and working controls.
