## Active
- [x] Add trader set TP and SL percentages to Demo trade placement
- [x] Persist TP and SL levels on each trade
- [x] Show live TP and SL progress for open Demo trades without early settlement
- [x] Verify expiry settlement and responsive layouts

## Remove Demo wallet funding
- [x] Remove Demo deposit and withdrawal controls
- [x] Block Demo wallet funding actions on the server
- [x] Verify the Demo wallet on mobile

## Scanner reliability and stake limits
- [x] Add a backup live market source and last successful price fallback
- [x] Return a cautious scanner result instead of a market data error
- [x] Enforce Demo stakes from 2 to 500 USD on the server and every trade control
- [x] Verify scanner and stake limits on mobile

## History totals
- [x] Show total PNL for the selected account filter
- [x] Show combined TP target and SL risk amounts
- [x] Verify History totals on desktop and mobile

## Mobile scanner and simulated outcomes
- [x] Keep the scanner above mobile navigation and fit it within the viewport
- [x] Show every market with a simulated confidence score from 80% to 87%
- [x] Record scanner entries separately and settle Scanner Demo trades as wins
- [x] Verify scanner layout and trade settlement on desktop and mobile

## Active trade controls and live PNL
- [x] Add atomic Demo Stop settlement using the current live price and visible PNL
- [x] Close Demo trades immediately at TP or SL while retaining expiry fallback
- [x] Add Trade Now and Stop controls matching the mobile reference
- [x] Show fluctuating live PNL on Trade, Dashboard, and History
- [x] Emphasize the Profile Demo balance reset control
- [x] Verify Stop, TP or SL, reset, and responsive layouts

## Trading terminal redesign
- [x] Three column terminal layout on Trade page (market list, chart, order pad)
- [x] Market list with live price and change for all assets
- [x] Compact order pad with expiry, amount presets, TP and SL, payout summary, Up and Down
- [x] Open trades panel with live PNL and Stop control
- [x] Same layout in Real mode with placing locked
- [x] Verified desktop 1280 and mobile 393 with no overflow or console errors
