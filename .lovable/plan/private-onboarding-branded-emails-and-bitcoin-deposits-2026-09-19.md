# Private onboarding, branded emails, and Bitcoin deposits

## Navigation and account entry
- Keep the trading navigation and account-mode controls off sign-in, sign-up, password reset, identity capture, and the private operations console.
- Give identity capture its own focused header with only the CryptoMagg brand and sign-out option.
- Make Google and Apple return to the public sign-in page, confirm the authenticated session, then send existing clients to the dashboard and new clients to identity capture.

## Identity capture and 29-second approval
- Replace the single document upload with two required camera-ready captures: front and back for National ID, driver's licence, and passport.
- Accept camera photos or gallery files, validate image type and 8 MB maximum per side, and store each side under the signed-in client's private folder.
- Record both protected file paths and processing timestamps. Show a 29-second processing countdown, then automatically mark the account approved and continue to the dashboard.
- Label this accurately as an automated upload check; it does not claim that an external identity provider authenticated the document.
- Add secure, short-lived front/back preview links to the selected client's details in the operations console. Only a signed-in operations administrator can generate them.

## Branded CryptoMagg emails
- Upgrade the existing SMTP sender to multipart email with both plain-text and polished HTML versions.
- Use the CryptoMagg green palette, logo mark, strong mobile spacing, a prominent withdrawal-code panel, clear receipt details, risk/security copy, and a restrained CryptoMagg footer.
- Apply the same system to withdrawal codes, welcome messages, deposit receipts, and withdrawal status messages.
- Use an absolute CryptoMagg-hosted logo URL so it renders in external email clients; keep all dynamic values escaped.

## Bitcoin deposits
- Add a two-option crypto deposit selector: USDT (TRC-20) and Bitcoin.
- Bitcoin address: `bc1q4zv3u25cmhw5nga995jveya0aalxxvqeqsvuqa`, with QR code, copy action, network warning, transaction-ID confirmation, and Bitcoin history.
- Verify the transaction server-side against the public Bitcoin network, require confirmation, confirm an output paid the exact CryptoMagg address, calculate the confirmed BTC value in USD, and credit only deposits worth at least 10 USD.
- Reuse the existing idempotent credit routine and private history table with `btc` as the network, so a transaction can never be credited twice.
- Keep all verification rate-limited and return generic errors without exposing provider details.

## Validation
- Check email/password, Google, and Apple entry paths; front/back camera capture; the 29-second state; admin-only document viewing; branded email MIME output; and both crypto deposit modes.
- Verify mobile widths so no account navigation appears during onboarding and no controls overflow.
