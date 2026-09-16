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

## Bigger market list, light and dark theme, ranking boards
- [x] Expand tradable markets to the top crypto coins with matching brand icons
- [x] Light mode by default with white and green surfaces plus a dark mode toggle in the top bar
- [x] Candlestick chart follows the selected theme
- [x] Market rankings boards on Markets (market cap, volume, gainers, losers) and a compact set on Dashboard
- [x] Stablecoins appear in rankings only, never in the trading list
- [x] Desktop and mobile checks with no overflow and no console errors
- [x] Soften the light theme and improve the theme toggle
- [x] Remove locked Real services wording across visible pages
- [x] Set Demo outcomes to an approximately 80 percent win mix with losses
- [x] Improve automatic trading controls for stronger risk management
- [x] Verify desktop and mobile behavior

## AI trading controls
- [x] Replace the automatic trading switch with clear Start trading and Stop trading buttons
- [x] Show running and stopped status in the Trade order panel
- [x] Keep automatic trades limited to one open position and the configured session controls

## Manual and auto trading options
- [x] Manual and Auto tabs in the order pad
- [x] Multipliers x1 to x300 scaling take profit and stop loss distance
- [x] Trade times 30s, 1m, 5m, 15m, 30m, 1h, 24h
- [x] Country list on sign up
- [x] Minus sign on negative numbers
- [x] Dark green side bands in light mode
- [x] Faster live price and PNL refresh
- [x] Trading bots on the trade tab with start and stop

## Bot trade sequences and flat light theme
- [x] Start a bot immediately when its card is selected
- [x] Let each bot execute several trades across different markets
- [x] Keep Stop trading and session risk limits active
- [x] Remove visible gradients from light mode
- [x] Count only completed losses toward the bot session loss limit
- [x] Verify bot execution and light mode on desktop and mobile

## Bot setup dialog
- [x] Open setup dialog when a trading bot is selected
- [x] Allow 30 second to 1 hour trade duration
- [x] Allow 5 to 40 trades per bot run
- [x] Automatically select eligible crypto markets
- [x] Verify setup and execution on desktop and mobile

## Bot PNL and trade transactions
- [x] Show combined live and settled Bot PNL on History
- [x] Add a Transactions tab for all bot and manual trades
- [x] Update active transaction PNL from live market prices
- [x] Use full transaction cards on mobile so no PNL details are hidden
- [x] Verify History on desktop and mobile

## Bot risk settings and varied outcomes
- [x] Add Take Profit and Stop Loss to bot setup
- [x] Prevent manual closing of bot trades
- [x] Close bot trades only at TP, SL, or expiry
- [x] Vary Demo expiry outcomes within a 60 to 80 percent practice range
- [x] Verify bot setup and active trade behavior

## Bot transaction flow
- [x] Add bot amount to the complete setup dialog
- [x] Enforce bot amounts from 1 to 2,000 USD
- [x] Open an in place live Transactions view after starting
- [x] Keep automatic market selection and running PNL visible
- [x] Verify the video inspired flow on desktop and mobile

## Martingale and bot alerts
- [x] Add optional Martingale from 1.25x to 5.5x
- [x] Increase the next amount after a settled loss and reset after a win
- [x] Cap Martingale at 2,000 USD and available Demo balance
- [x] Play distinct win and loss sounds
- [x] Add a bot session reset action
- [x] Verify setup and reset on desktop and mobile

## Trade countdown, stopping, and Demo outcome target
- [x] Show hours, minutes, and seconds remaining on every running trade
- [x] Allow manual stopping of bot and manual Demo positions
- [x] Set expiry outcomes to a labeled 95 percent simulated practice target
- [x] Verify countdown and stop controls on desktop and mobile

## Dollar Take Profit and Stop Loss
- [x] Store Take Profit and Stop Loss as dollar amounts for new trades
- [x] Use dollar targets for live PNL and manual stopping
- [x] Show dollar targets in Trade and History
- [x] Preserve readable values for earlier percentage based trades
- [ ] Verify manual and bot setup on desktop and mobile
