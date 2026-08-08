## Goal

Every company gets a 60-day free trial. When the trial ends, the app is locked behind a paywall screen — but nothing is ever deleted, and existing companies are grandfathered as paying accounts.

## Database migration

Add to `companies`:
- `trial_ends_at` (timestamp, nullable)
- `subscription_status` (text, default `trialing`, allowed: `trialing`, `active`, `expired`, `comped`)
- `activated_at` (timestamp, nullable)
- `billing_note` (text, nullable)

Also:
- Update `create_company_workspace` so new workspaces start with `trial_ends_at = now() + 60 days` and `subscription_status = 'trialing'`.
- Backfill: every company that exists today becomes `subscription_status = 'active'` with `activated_at = now()` — no current account gets locked out.
- Owners/admins can edit the billing fields; all members can read them (needed by the access gate).

## Access rules

| Status | Result |
| --- | --- |
| `active`, `comped` | Full access, no banner |
| `trialing`, still within trial | Full access + banner "X days left in your free trial" |
| `trialing` past `trial_ends_at`, or `expired` | Locked — paywall screen |

Paywall screen:
- Owner: "Your 60-day free trial has ended. To keep using EventFlow, please subscribe — contact <support email>." Owner can still reach the billing/contact screen and account settings (Settings → Company / Team), plus sign out.
- Other members: simpler message — "Your team's trial has ended — ask your account owner to subscribe." Sign out only.

Data is untouched in every case; this only gates the UI.

## Technical notes

- New `src/lib/billing.ts`: `TRIAL_DAYS = 60` (the single constant), plus `getTrialState(company)` returning `{ status, locked, daysLeft, isTrialing }`.
- New `src/lib/use-subscription.ts`: hook reading the current company's `subscription_status` / `trial_ends_at` (same pattern as `usePermissions`).
- New `src/components/paywall-gate.tsx`: renders children, the trial banner, or the paywall screen. Mounted inside `AppShell` so every authenticated page is covered with one change; Settings routes stay reachable for owners.
- `src/components/app-shell.tsx`: fetch the two extra columns alongside the existing company query and wrap `{children}`.
- No changes to deals/proposals/analytics logic.

## Open item

The paywall needs a contact email address to show. Tell me which address to use, otherwise I'll wire it as a constant in `src/lib/billing.ts` that you can edit in one place.
