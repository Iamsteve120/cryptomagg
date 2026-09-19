# Admin dashboard, client IDs, richer sign-up and KYC

A large change set, grouped into five pieces. All of it is mobile-first: nothing overlaps, no sideways scrolling, no zoom jumps when moving between pages.

## 1. Admin dashboard (mobile-first)

A new admin-only page, reachable only by accounts marked as admins (checked on the server, not just hidden in the menu).

Time range picker: 10 min, 30 min, 1 h, 6 h, 12 h, 1 day, 72 h, 1 week, 15 days, 1 month — shown as a horizontally scrollable chip row so it never breaks the layout on a phone.

For the chosen range it shows:
- Total clients signed up, plus new sign-ups in the range
- Clients active in the range (signed in / traded) and how many are currently active
- Total deposited, total withdrawn, net house position
- Trades placed, total staked, win/loss split
- A percentage up/down indicator for each number, comparing the chosen range with the previous equal-length range (green for up, red for down)

Below the KPIs: a client list with search. Searching by client ID, email, name or phone opens a client detail view showing every stored detail — client ID, full name, email, country, phone, age/terms acknowledgement, KYC document and status, balances, total deposited, total withdrawn, trade history summary, sign-up date, last seen.

## 2. Client ID numbers

Each account gets a unique, permanent ID in the form `IDCW068202` (fixed prefix + 6 digits). Generated automatically at sign-up, and backfilled for every account that already exists. Shown on the client's own profile page and searchable in the admin dashboard.

## 3. Sign-in and sign-up

- "Forgot password" link with an email reset flow and a dedicated page to set the new password.
- Continue with Google and Continue with Apple buttons on both sign-in and sign-up.
- New sign-up form collects: first name, second name, email (with confirmation step), country, mobile phone number, a tick box for the site terms and conditions, a tick box confirming the person is over 18, and a KYC upload of one of: national ID, driver's licence, or passport.
- KYC files go to a private store that only the owner and admins can read.
- A congratulations email is sent once the sign-up is complete.

## 4. Mobile layout pass

Go through the landing page, sign-in, dashboard, markets, trade, history, wallet and profile and fix the zoom/overflow problems: lock the page zoom behaviour, make every header row use the safe two-column pattern, allow long text to truncate, and make wide tables scroll inside their own card instead of pushing the page sideways.

Also: remove the decorative generated icons and the "Live prices · simulated money" style badges and feature icons flagged in the screenshot, and delete the footer paragraph beginning "Trade crypto the simple way…".

## 5. Always-moving market numbers

Any percentage or price shown as a flat value (for example a 0.06% change that never moves) is driven off the live feed and refreshed on a short interval, so nothing on the site looks frozen.

## 6. Security hardening

- Admin access enforced by a role stored in its own table and checked on the server for every admin request.
- Rate limiting and repeated-failure blocks on sign-in, password reset, the withdrawal code, and admin search.
- Server-side validation on every new input (names, phone, country, KYC file type and size).
- KYC storage private by default with owner/admin-only access rules.
- Close the remaining warning on the live-account status endpoint by requiring an admin session.
- Generic error messages to users; no internal details leaked.

## Technical notes

- New tables: `user_roles` (+ `has_role` security-definer function), client ID column on `profiles` with a unique index and a backfill, KYC columns/table, and a `login_events` table to power "active clients". All with RLS, explicit GRANTs, and admin reads via `has_role`.
- Private storage bucket for KYC documents with owner/admin policies.
- Admin aggregates computed in server functions guarded by `requireSupabaseAuth` plus an admin role check; time ranges computed server-side.
- Google and Apple sign-in enabled through the managed social login configuration; email/password reset uses the existing auth email transport, congratulations email via the existing Nodemailer server module.
- Sign-up becomes a short multi-step form to keep each step readable on a phone.

## Scope note

This is a lot of ground. I will build it in the order above and keep each piece working before moving on.
