## Goal

A platform-owner console at `/admin`, only for you — separate from per-company roles — to see every company account and change its billing state, with every action logged.

## Database migration

New table `platform_admins`:
- `user_id` (nullable, links to a signed-in user), `email` (unique, lowercase), `created_at`
- Seeded with `kauf.keren@gmail.com`
- Matching happens on either the user id or the signed-in email, so the seed works before you ever sign in.

New helper `is_platform_admin()` — SECURITY DEFINER, returns true when the current session's user id or email is in `platform_admins`.

New table `platform_audit`: `company_id`, `actor_id`, `action` (activate / extend_trial / comp / lock), `detail` (JSON: days added, note, previous status), `created_at`.

Access rules:
- `platform_admins` and `platform_audit`: readable and writable only when `is_platform_admin()`.
- `companies`: add a policy so platform admins can read all rows and update billing state on any company. Existing per-company policies stay untouched.

## The /admin route

Hidden from everyone else: not linked in the sidebar unless you are a platform admin, and the page itself only renders after a server check. Non-admins get redirected away, so knowing the URL is not enough.

Company table columns:
- Name, signup date, trial ends, status badge (trialing / active / expired / comped), user count, last activity (most recent deal update in that company).
- Search by name and filter by status.
- Row expands to show the recent action log for that company.

Per-company actions (each writes a `platform_audit` row):

| Action | Effect |
| --- | --- |
| Activate | status → `active`, sets `activated_at`, requires a note (e.g. "paid by transfer, invoice #123") stored in `billing_note` |
| Extend trial | status → `trialing`, `trial_ends_at` += N days (N you type) |
| Comp | status → `comped`, free forever, optional note |
| Lock | status → `expired` |

The existing paywall gate already reacts to these statuses, so a change takes effect for that company on their next load. No data is ever deleted.

## Technical notes

- `src/lib/platform.functions.ts` — server functions behind `requireSupabaseAuth`, each re-checking `is_platform_admin()` via the caller's own client before doing anything: `getPlatformOverview`, `setCompanyBilling` (one entry point for all four actions), `getCompanyAuditLog`.
- User counts / last activity come from aggregate queries, not from shipping deal rows to the browser.
- `src/lib/use-platform-admin.ts` — small hook so the sidebar can conditionally show the "Platform" link.
- `src/routes/_authenticated/admin.tsx` — the console (table + action dialogs), plus `src/components/platform-company-table.tsx` for the table itself.
- No changes to existing per-company roles, permissions matrix, or the paywall logic.
