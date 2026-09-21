# Crypto withdrawals

## What will change
- Add a crypto withdrawal choice in the live wallet for Bitcoin and USDT on Tron.
- Let the client paste their own receiving address, enter the amount, and confirm through the existing emailed one-time code.
- Show crypto withdrawal status and destination in recent funding activity.

## Safety and payout handling
- Validate each address on the server for the selected network.
- Keep the two-real-trade requirement, minimum withdrawal, rate limiting, balance checks, and one-pending-withdrawal rule.
- Reserve funds atomically only when the automatic payout provider is configured and accepts the payout; refund automatically after submission failure.
- Keep payout credentials server-only and verify signed provider callbacks before marking a withdrawal complete.

## External requirement
Automatic sending cannot activate until a funded crypto payout-provider account and its server-only credentials are connected. The wallet controls and protected request flow can be prepared now, but requests will remain unavailable rather than falsely claiming a payout was sent.
