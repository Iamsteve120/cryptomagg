# CryptoMagg USDT account and interface refresh

## Outcome
Add a clear Demo and Live account switch. Demo remains fully usable. Live is denominated in USDT and starts at 0 USDT, but cannot accept funds or place trades until a verified payment and trading provider is connected.

The deposit page will be prepared for M Pesa with the requested presets and KES conversion, without publishing a random till, accepting money, or crediting balances before provider confirmation.

## Account experience
- Add a persistent account selector for **Demo** and **Live** in the signed in navigation.
- Show the selected balance consistently across the dashboard, trading page, wallet, and profile.
- Keep Demo behavior unchanged.
- Show Live balances in USDT and clearly mark Live actions as unavailable pending verification.
- Prevent Live trades and withdrawals on both the screen and server until a verified provider is implemented.

## Deposit experience
- Make **Deposit** the primary wallet action.
- Add an M Pesa deposit panel with USDT presets: 2, 4, 8, 10, 15, and 20.
- Add a manual USDT amount field.
- Show an estimated KES conversion using a server fetched exchange rate, with a safe fallback label when the rate is unavailable.
- Show the intended account name **CryptoMagg**, but no till or paybill number until verified provider details are connected.
- Do not create completed transactions, alter the Live balance, or imply a payment succeeded without a signed provider callback.

## Market card redesign
- Add a reusable crypto market card under the existing UI components folder, adapting the supplied stock card to the app’s real crypto quote data.
- Install Framer Motion and use restrained entry and interaction motion with reduced motion support.
- Use local, consistent asset initials or marks rather than external hotlinked logos.
- Use the new cards on both Dashboard and Markets with the existing Trade action.
- Keep the interface dense and professional: flatter sections, smaller corner radii, restrained green accents, less glow, and clearer hierarchy.

## Copy cleanup
- Remove visible hyphens where natural wording works, including **M Pesa**, **sign in**, and **Up or Down**.
- Keep the permanent legal disclaimer clear that Demo uses simulated money.
- Clearly distinguish the locked Live account from the Demo simulator so users are never led to believe funds were received.

## Technical details
- Add a database migration for a zero default Live USDT balance and account mode fields where needed, with explicit grants, RLS, constraints, and owner scoped access.
- Keep privileged balance changes server only, validated, rate limited, and atomic.
- Add no secrets, payment keys, public wallet addresses, or client trusted balance updates.
- Update every affected page’s metadata and wording where required.
- Verify desktop and mobile layouts, account switching, amount presets, conversion display, disabled Live actions, and market card navigation.

## Live payment limitation
Paddle was the available recommendation for the current Kenya based setup, but this financial product requires additional review and approval is not guaranteed. Paddle checkout is not a substitute for M Pesa account funding or a regulated trading wallet. This implementation therefore prepares and locks the Live flow; activation requires a verified M Pesa or regulated custody/trading provider and its signed webhook credentials.
