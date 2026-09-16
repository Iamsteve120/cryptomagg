# Active Demo Trade Controls and Live PNL

## Build

- Add a prominent Trade Now area matching the uploaded mobile flow, with Up and Down entry actions that switch to a Stop action while a position is active.
- Stop an open Demo trade immediately at the latest live market price and settle the exact visible live PNL into the Demo balance.
- Close open Demo trades immediately when their saved Take Profit or Stop Loss price is reached. Keep expiry settlement for trades that reach neither level.
- Keep prices refreshing from the live market providers, with the existing backup and last successful snapshot protection.
- Show each open trade's fluctuating live PNL on Trade, Dashboard, and History, including countdown, live price, and TP or SL state.
- Keep the existing visible reset control on Profile, strengthen its prominence, and refresh all balance and trade displays after reset.

## Safety and records

- Validate Stop requests on the server, require the signed in owner, and settle atomically so one trade cannot close twice.
- Record exit price, exact PNL, result, settlement time, and resulting balance on every manual Stop, TP, SL, or expiry closure.
- Keep all actions Demo only. Real trading stays locked.

## Verification

- Verify mobile layout at the uploaded phone size and desktop layout.
- Open a Demo trade, observe live PNL on Trade and History, stop it, and confirm the balance and history record match.
- Verify automatic TP or SL closure and the Profile reset button.
