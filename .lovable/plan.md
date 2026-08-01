## What already exists (verified)

Most of this prompt was already built in the previous turn:

- Table `staff_roles` (same shape as the requested `staff` table): `id`, `company_id`, `name`, `name_de`, `category` (default `'staff'`), `description`, `long_description`, `long_description_de`, `pricing_type` (`extra_pricing_type`, default `per_hour`), `price`, `basis`, `tax_rate_pct`, `active` (default true), `created_at`, `updated_at` — with the company RLS pattern.
- Route `src/routes/_authenticated/catalog.staff.tsx` with the Extras-style CRUD UI (EN/DE fields, pricing type, basis, tax, preview breakdown, category defaults bar).
- "Staff" tab already in `catalog.tsx`.
- Generated Supabase types already include `staff_roles`.

No new migration is needed. Renaming the table to `staff` would break the code already wired to `staff_roles` for no benefit, so I'd keep the current name.

## What's actually missing

1. **Activate / deactivate.** Neither the Extras page nor the Staff page can toggle `active` — the field just defaults to true. Add a boolean field type to `src/components/crud-list.tsx` (a checkbox rendered like the other fields, written into the insert/update payload as a real boolean).
2. **Staff page uses it.** Add an "Active" checkbox to the field list in `catalog.staff.tsx`, defaulting to true, and show an "Inactive" badge in the row renderer for rows where `active` is false.
3. **German short description parity.** The Staff page currently offers `name_de` and `long_description_de` but not a German short description. `staff_roles` has no `description_de` column. Two options — I'd do (a) unless you say otherwise:
   - (a) Leave it: short `description` is internal-facing only, so no DE needed (matches Extras).
   - (b) Add `description_de` via a small migration and a paired field.

## Technical notes

- `crud-list.tsx` gains `type: "checkbox"`; submit path converts `fd.get(name)` presence to `true/false` (unchecked checkboxes are absent from FormData, so it must be handled explicitly, not via the generic string branch).
- Inactive rows stay visible in the manager list; filtering by `active` belongs to the proposal builder, which is out of scope here.

## Out of scope

No changes to the proposal builder, client proposal page, contracts, or invoices.
