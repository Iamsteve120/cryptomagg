# Simplify the operations console

## Build
- Replace the current dashboard figures with three focused views: total M-Pesa deposits, total M-Pesa withdrawals, and real-account market losses.
- Keep the time-range selector so each total reflects the selected period.
- Simplify each client row to name, email, client ID, and phone. Tapping it opens their M-Pesa activity details.
- Show each deposit as a green `+` entry and each withdrawal as a red `−` entry, including official M-Pesa code, KES amount, USDT amount, status, phone, and time.
- Remove trade/profile/balance clutter from the client detail panel.
- Deduplicate the live log so one M-Pesa action appears once as a complete entry, rather than appearing separately as both a request and transaction.

## Technical details
- Build deposit and withdrawal totals from confirmed M-Pesa records, not generic transaction rows.
- Calculate market losses from settled real-account trades with negative PNL.
- Match records by provider receipt and source ID where available; use a deterministic fallback key for pending entries.
- Preserve the existing admin sign-in checks, hidden-account rules, fresh-start date, and payout diagnostics.
- Verify the updated console at desktop and mobile widths.
