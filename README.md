# Cryptomagg

Make the ui ux look this green





Good — that changes things. A dummy/simulated payment UI (no real money moves, no real wallet integration) is fine to build. Here's the full Lovable prompt:

---

**Prompt for Lovable:**

> Build a full-stack crypto trading web app called "CryptoMagg" (site: cryptomagg.site), responsive for both desktop and mobile.
>
> **⚠️ Important: This is a demo/paper-trading app. No real payments are processed anywhere. All deposits are simulated and just add to an in-app demo balance. Do not integrate any real payment gateway, real M-Pesa API, or real blockchain wallet.**
>
> **Branding:** Dark theme, neon green/purple gradient accents, crypto-native aesthetic (glowing buttons, candlestick charts), logo placeholder "CryptoMagg."
>
> **Auth:** Email/password sign up and login via Supabase.
>
> **Pages/wireframes:**
>
> 1. **Landing page**
>    - Header: logo left, nav links (Home, Markets, How it Works, Login/Signup) right, hamburger menu on mobile
>    - Hero: headline, subtext, "Get Started" CTA, live scrolling ticker strip of top coins below hero
>    - Features section: 3-column (4-column on desktop, stacked on mobile) cards — "Real-time prices," "Fast trades," "Simple payouts"
>    - Footer: links + bold disclaimer: "Demo platform. No real funds are transacted. For entertainment/educational purposes only."
>
> 2. **Dashboard (main trading screen)**
>    - Desktop layout: left sidebar (asset list + search), center (chart + trade panel), right sidebar (trade history / open positions)
>    - Mobile layout: top asset selector bar (horizontal scroll), chart full-width, trade panel below chart, trade history in a bottom tab/sheet
>    - Components:
>      - Asset dropdown/search populated from this list: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT, DOGEUSDT, TRXUSDT, TONUSDT, AVAXUSDT, LINKUSDT, DOTUSDT, MATICUSDT, LTCUSDT, SHIBUSDT, ATOMUSDT, NEARUSDT, ICPUSDT, XLMUSDT, ETCUSDT
>      - Live candlestick chart pulling real price data from Binance public REST/WebSocket API (`https://api.binance.com/api/v3/ticker/price?symbol=...` and `wss://stream.binance.com:9443/ws/<symbol>@trade`) — read-only market data display, no order routing
>      - Countdown timer selector (30s / 1min / 5min)
>      - Up/Down buttons, stake input, current demo balance shown prominently
>      - "Place Trade" button, disabled if stake > balance
>
> 3. **Trade history page**
>    - Table (cards on mobile): timestamp, asset, direction, stake, entry price, result price, outcome (win/loss), payout
>    - Filter by asset / date range
>
> 4. **Wallet page (simulated deposits only)**
>    - Two tabs: "M-Pesa (Demo)" and "Crypto (Demo)"
>    - M-Pesa tab: shows dummy till number field (static display, e.g. "Till: 000000 — DEMO ONLY, do not send real money"), an amount input, and a "Simulate Deposit" button that instantly credits the demo balance after a fake 2-second "processing" spinner
>    - Crypto tab: shows a static placeholder QR code image and a dummy wallet address string with a "Copy" button, clearly labeled "Demo address — do not send real crypto," amount input, and a "Simulate Deposit" button with the same fake processing flow
>    - Deposit history list below (simulated transactions only)
>
> 5. **Profile/settings page**
>    - Avatar placeholder, email, change password, logout, reset demo balance button
>
> **Tech notes:**
> - Use Supabase for auth, and to store users, demo balances, and trade/deposit history
> - All balances are virtual integers in the database — no payment processor, no real wallet, no real M-Pesa Daraja API integration
> - Trade settlement logic: on countdown expiry, compare entry price vs. price at expiry (from the live feed) to determine win/loss, and credit/debit the demo balance accordingly
> - Persistent banner or footer disclaimer across every page: "CryptoMagg is a demo trading simulator. No real money is involved."

---

This gives Lovable everything it needs — wireframe structure, component breakdown, real market data for realism, and fully simulated money flows. Let me know if you want the win/loss payout math (e.g., fixed 80% return) spelled out too.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cryptomagg.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c0fc30da-5297-41cf-a42f-dd5c2a463532).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
