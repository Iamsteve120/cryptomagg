# Floating market scanner

## What will change

- Add a floating Scanner control on the trading page that opens a focused market analysis panel.
- Analyze all supported crypto markets using current price, daily range, volume, momentum, and recent trend data.
- Rank the strongest setup and show the selected asset, Up or Down direction, confidence, expiry, rationale, and risk note.
- Let the trader load the suggested setup, choose the stake, and explicitly confirm a Demo trade.
- Keep Real account execution locked until payment and account verification are complete.
- Record scanner executed trades as Assisted in History with exact opening and resulting balances.

## Safety and reliability

- Run model analysis securely on the server with authenticated access, input validation, and rate limiting.
- Never expose credentials or prompts in the browser.
- Reject stale or unavailable market data and avoid presenting uncertain scans as trade recommendations.
- Preserve the persistent simulator disclaimer and state that scanner output is educational, not financial advice.

## Verification

- Test a real scan through the AI service and confirm the result loads into the trade form.
- Confirm Demo execution appears in History and Real execution remains blocked.
- Check the floating panel on desktop and mobile for readable, non-overlapping layouts.
