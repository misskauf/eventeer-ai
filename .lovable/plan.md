## Goal

Data model + helpers for a real roles & permissions system. No UI or enforcement yet (that's 16b–16c).

## 1. Migration

**Roles enum**
- Add `sales_manager` and `event_manager` to `app_role`. (Enum values are added in their own statement first, then used in a later statement, so the migration is split into two blocks.)
- Migrate existing rows: `sales → sales_manager`, `manager → event_manager`. `owner` and `accounting` unchanged.
- Old values `sales` / `manager` stay in the enum, unused (dropping enum values is unsafe).

**`role_permissions`**
- `id`, `company_id` → companies, `role app_role`, `module text`, `level text` (`none|view|edit|admin`), `scope text` nullable (`own|all`), timestamps.
- Unique on `(company_id, role, module)`; check constraints on `level`, `scope`, and the allowed module list: deals, proposals, contracts, invoices, catalog, staff, costs, analytics, event_briefs, lead_forms, settings, team.
- GRANTs to `authenticated` + `service_role`; RLS: members of the company can read; only owners can write.

**`user_roles` additions**
- `active boolean not null default true`
- `status text not null default 'active'` (`active|invited|disabled`).

**`company_invites`**
- `id`, `company_id`, `email`, `role app_role`, `token text unique`, `invited_by`, `expires_at`, `accepted_at`, `created_at`.
- RLS: owners of the company manage; token lookup happens server-side (no anon policy). GRANTs as above.

**`permission_audit`**
- `id`, `company_id`, `actor_id`, `action text`, `target text`, `detail jsonb default '{}'`, `created_at`.
- RLS: owners of the company can read; inserts happen server-side. GRANTs as above.

**Default presets**
Seeded for every existing company, and for new companies via an update to `create_company_workspace` (plus a helper `seed_role_permissions(_company_id)` so both paths share one definition):

| module | owner | sales_manager | event_manager | accounting |
|---|---|---|---|---|
| deals | admin | edit (scope all) | view | view |
| proposals | admin | edit | view | none |
| contracts | admin | edit | view | none |
| invoices | admin | view | none | edit |
| catalog | admin | view | view | none |
| staff | admin | none | edit | none |
| costs | admin | none | none | view |
| analytics | admin | view | view | view |
| event_briefs | admin | edit | edit | none |
| lead_forms | admin | edit | none | none |
| settings | admin | none | none | none |
| team | admin | none | none | none |

Owner rows are seeded as `admin` everywhere for completeness, but owner is short-circuited in code and never editable.

**`has_permission(_company_id uuid, _module text, _min_level text)`**
SECURITY DEFINER, STABLE, `search_path = public`. Returns true if the caller is `owner` of that company; otherwise compares the caller's `role_permissions.level` against `_min_level` using the ordering none(0) < view(1) < edit(2) < admin(3). Requires the caller's `user_roles` row to be `active`. Companion `permission_level(_company_id, _module)` returning the effective level text (`'admin'` for owner) for UI use.

## 2. Server helper

`src/lib/permissions.server.ts`
- `LEVELS` ordering + `Module` / `Level` types.
- `requirePermission(supabase, companyId, module, minLevel)` — calls the SQL function via `rpc`, throws `Error('Forbidden: <module> requires <level>')` when false.
- `getCallerCompanyId(supabase, userId)` convenience (reuses the `user_roles` lookup) so server fns can do `await requirePermission(...)` in one line.
- `logPermissionAudit(...)` writing a `permission_audit` row.
No existing server functions are changed in this prompt.

## 3. Client hook

`src/lib/permissions.tsx`
- `usePermissions()` → `{ role, companyId, isOwner, levels, can(module, level), scope(module), loading }`.
- Loads the user's `user_roles` row and that company's `role_permissions` rows in two queries; owner short-circuits `can()` to `true`.
- Module/level constants and human labels exported here for the 16b settings UI.
- Existing `useCompanyRole` / `useCanViewCosts` stay as-is so nothing breaks; `costs` module coexists with `cost_visible_roles` until 16c consolidates them.

## Notes

- `NON_OWNER_ROLES` in `src/lib/cost-visibility.tsx` is updated to the new role values so the existing Team settings checkboxes keep matching real roles.
- Nothing gets enforced yet — existing pages behave exactly as today.
