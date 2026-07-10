## Problem

Workspace creation succeeds (the `companies` row is inserted), but the two follow-up inserts in `src/routes/onboarding.tsx` silently fail:

- `user_roles` has no INSERT policy at all — only SELECT. The creator cannot add their own owner row.
- `fee_config` INSERT requires `is_member_of(auth.uid(), company_id)`, which is false until the user_roles row exists.

Errors from these inserts aren't surfaced, so the code navigates to `/deals`. The `_authenticated` guard sees no membership and sends the user back to `/onboarding`, which then shows the empty form again.

## Fix

1. **Database migration** — add a `SECURITY DEFINER` function `public.create_company_workspace(name, primary_color, currency)` that, in one transaction:
   - inserts a `companies` row with `created_by = auth.uid()`
   - inserts a `user_roles` row (`user_id = auth.uid()`, `role = 'owner'`)
   - inserts a default `fee_config` row
   - returns the new `company_id`
   
   Grant EXECUTE only to `authenticated`. This avoids adding a broad INSERT policy on `user_roles` (which would let any authenticated user grant themselves a role in any company).

2. **Frontend** — update `src/routes/onboarding.tsx` to call the RPC via `supabase.rpc('create_company_workspace', {...})` instead of three separate inserts, and surface any error via toast before navigating.

No other files change.