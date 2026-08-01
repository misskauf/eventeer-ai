## Goal

Track an internal cost on every catalog item, show cost/margin only to permitted roles, and never expose costs to clients.

## 1. Database migration

- `spaces`, `fb_packages`, `extras`, `staff_roles` (the staff catalog table): add `cost numeric NULL DEFAULT 0`. Same unit as that item's price — per person for food/beverage packages, per event for a space's rental fee, matching `pricing_type` for extras and staff lines.
- `companies`: add `cost_visible_roles text[] NOT NULL DEFAULT '{}'` — non-owner roles allowed to see costs.
- Extend the `app_role` enum with `accounting` so it can be granted (current roles: owner, manager, sales).
- No RLS changes needed: all four catalog tables and `companies` are already company-scoped and internal-only; clients never authenticate.

## 2. Permission helper

New `useCanViewCosts()` hook (in `src/lib/auth-hooks.ts`):
- Reads the current user's `user_roles.role` and the company's `cost_visible_roles`.
- Returns `true` when role is `owner` (admin), or when the role is listed in `cost_visible_roles`.
- Also exposes `role` so Settings can gate the editor to owners.

## 3. Catalog forms and lists

For each of `catalog.spaces.tsx`, `catalog.food.tsx` / `catalog.beverages.tsx` (via `catalog-packages-page.tsx`), `catalog.extras.tsx`, `catalog.staff.tsx`:
- Add an "Internal cost" number field next to the price field, hint: "Not shown to clients."
- In the list row, when `useCanViewCosts()` is true, show cost plus margin: `price − cost` and margin % (`(price − cost) / price × 100`), styled like the existing muted meta line. When false, render nothing — the cost field is also hidden from the add/edit form.

## 4. Settings — Cost visibility

Add a "Cost visibility" card under Settings → Team & users (`settings.team.tsx`):
- Checkboxes for each non-owner role (Manager, Sales, Accounting) writing to `companies.cost_visible_roles`.
- Owner always sees costs (shown as a fixed, disabled note).
- Only owners can edit; other roles see it read-only.

## 5. Client-side safety

- No `cost` added to any column list in `public-share.functions.ts` (these already use explicit column lists, so nothing leaks by default).
- No cost in the client proposal page, contract rendering, invoices, or PDF output.
- Pricing engine untouched — cost never enters totals.

## Technical notes

- `spaces` cost pairs with `base_rental_fee`; `fb_packages` cost pairs with `price_per_person`; `extras`/`staff_roles` cost pairs with `price`.
- `CrudList` already supports nullable number fields, so the cost field needs no component changes; conditional inclusion happens where the `fields` array is built.
- Margin % is hidden when price is 0 to avoid divide-by-zero.
