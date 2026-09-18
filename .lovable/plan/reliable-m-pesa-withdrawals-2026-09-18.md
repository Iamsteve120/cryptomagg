# Reliable M-Pesa withdrawals

## What will change
- Show the live available USDT balance prominently inside the withdrawal panel, with a quick “use available” action.
- Stop treating M-Pesa's initial acceptance as a completed payout; keep it pending until M-Pesa confirms the final result.
- Process B2C success and failure callbacks: mark successful withdrawals completed, or atomically return the held amount when M-Pesa rejects/fails the payout.
- If B2C credentials or the KES conversion rate are unavailable, return the held amount immediately instead of leaving it deducted and pending.
- Send the withdrawal email only with the accurate final state, and display clear pending/failed/completed status in Recent funding.
- Safely return the currently stuck pending withdrawals after confirming they have no provider receipt, so the held balance is restored once rather than duplicated.

## Technical details
- Add a narrowly callable backend database routine for idempotent withdrawal completion/refund; only the server role can execute it.
- Extend the existing public M-Pesa callback to validate and handle both STK deposit callbacks and B2C result callbacks.
- Store the M-Pesa conversation ID on accepted payout requests and use it to match the final callback.
- Keep all payout authorization and balance changes server-side.

## Verification
- Check the withdrawal panel at desktop and mobile sizes.
- Verify missing configuration and provider failure return funds without duplicate credits.
- Verify an accepted request remains pending until a success callback arrives.
