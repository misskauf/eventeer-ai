# Archive and delete for deals / leads

Two new lifecycle actions on a deal: **Archive** (reversible, keeps everything) and **Delete** (permanent, removes the deal and everything attached to it).

## Database change

- Add `archived_at` (nullable timestamp) to `deals`. Empty = active, set = archived.
- Related tables (`proposals`, `proposal_selections`, `contracts`, `deal_activities`, `deal_items`, `share_tokens`, `notifications`, `event_briefs`, `invoices`) already delete automatically when a deal is deleted, so no extra cleanup code is needed.
- Add a delete access rule on deals so only owners / users with admin-level Deals access can permanently delete, and confirm the update rule allows archiving.

## Archive (soft)

- Deal list, board and calendar hide archived deals by default.
- A small "Archived" toggle/filter in the deals list switches the view to archived deals only; archived rows are visually muted and show an "Archived" badge.
- Archive action available from the deal row menu and the deal detail page header.
- Restore action (clears the archive) appears wherever a deal is archived.
- Both archive and restore write a history entry on the deal (`deal_archived` / `deal_restored`) so the activity log stays complete.
- Requires **edit** access on Deals.

## Delete (permanent)

- Delete action in the same menus, styled destructive and visually separated.
- Confirm dialog with the exact warning: "This permanently deletes the lead and its proposals, contract, brief, invoices, and history — it cannot be undone." Confirm button says "Delete permanently".
- On confirm, the deal and all attached records are removed; the user is returned to the deals list with a toast.
- Requires **admin** access on Deals (owners always pass).

## Technical notes

- Migration: `ALTER TABLE public.deals ADD COLUMN archived_at timestamptz`, plus an index on `(company_id, archived_at)` and a `DELETE` RLS policy using the existing `has_permission(company_id, 'deals', 'admin')` helper.
- Queries in `deals.index.tsx`, `deals.calendar.tsx` and any dashboard/analytics deal lists get `.is("archived_at", null)` unless the archived view is on.
- Mutations go through the browser Supabase client (RLS-enforced), with client-side gating via `usePermissions().can("deals", "edit" | "admin")` so unavailable actions are hidden.
- Deal detail page (`deals_.$id.tsx`) gets an archived banner with a Restore button, and its header menu hosts Archive/Delete.
- Types regenerate after the migration.
