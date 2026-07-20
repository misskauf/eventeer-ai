## Problem

Save fails with `403: new row violates row-level security policy for table "contract_templates"`.

Root cause confirmed from network logs: Settings loads the company via `companies?select=*&limit=1`, which returns company `0818a815-…` — but the signed-in user's `user_roles` row points at a different company `999d919e-…`. The user is not a member of `0818a815-…`, so the RLS policy on `contract_templates` (which requires membership via `is_member_of`) rejects the insert.

In other words, `src/routes/_authenticated/settings.tsx` picks "any company" instead of "the user's company", and the wrong `company_id` gets stamped onto the insert.

## Fix

Scope company loading in Settings to the user's actual company.

1. In `src/routes/_authenticated/settings.tsx` `load()`:
   - Get `user_roles.company_id` for `auth.uid()` first.
   - Then `companies.select('*').eq('id', <that id>).maybeSingle()`.
   - If the user has no `user_roles` row, redirect to `/onboarding` (existing flow) instead of loading a stray company.
2. Same-turn: audit other places that do `companies…limit(1)` without a user filter (`app-shell`, currency hook, contracts panel loads) and switch them to the `user_roles`-scoped lookup so brand/currency/templates all agree on one company.

No schema/RLS changes — policies are correct; the client was just sending the wrong `company_id`.

## Verification

- Reload Settings → confirm the loaded company id equals the `user_roles.company_id` (`999d919e-…`).
- Create/save a contract template → expect `201`, not `403`.
