## Goal

Restructure the catalog so packages, extras, and spaces all carry rich pricing info (basis, tax, description) and show live net/tax/gross totals. Split Food and Beverage packages into two catalog tabs. Let the deal builder override guest count per package.

## Changes

### 1. Database migration

- `fb_packages`: add `kind` ('food' | 'beverage', default 'food'), `basis` ('net' | 'gross', nullable — falls back to category default), `tax_rate_pct` (numeric, nullable), `long_description` (text).
- `extras`: add `basis`, `tax_rate_pct`, `long_description`.
- `spaces`: add `basis`, `tax_rate_pct`, `long_description`.
- `fee_config`: add category default columns `default_basis_food`, `tax_rate_food`, `default_basis_beverage`, `tax_rate_beverage`, `default_basis_extra`, `tax_rate_extra`, `default_basis_rental`, `tax_rate_rental` (with sensible defaults derived from existing `tax_pct`).
- `proposal_selections` (or a new `proposal_line_overrides` table): add `guest_count_override` (int, nullable) keyed by proposal + package id, so per-package guest overrides persist on saved proposals.

Grants + RLS follow existing table policies (company-scoped).

### 2. Catalog UI

- Split `catalog.packages.tsx` into `catalog.food.tsx` and `catalog.beverages.tsx` (both use `CrudList` on `fb_packages` filtered by `kind`, insert with the right `kind`).
- Update catalog nav/tabs in `catalog.tsx` to show: Spaces · Food · Beverages · Extras · Rules.
- Extend forms for packages, extras, and spaces with new fields:
  - Long description (textarea).
  - Basis toggle (Net / Gross / Use category default).
  - Tax rate input, revealed when basis is Net and override is on.
- Add a "Category tax defaults" card in `settings.tsx` (or in `catalog.rules.tsx`) to edit `fee_config` category basis + tax rates.

### 3. Shared pricing helper

Add `src/lib/tax.ts` with:
- `resolveBasis(item, categoryDefault)` → 'net' | 'gross'.
- `resolveTaxRate(item, categoryDefault)` → number.
- `splitNetTaxGross(amount, basis, taxRatePct)` → `{ net, tax, gross }`.

Use this from a new `PriceBreakdown` component that shows Net · Tax · Gross for any priced entity, given a guest count.

### 4. Catalog item calculator

On each package/extra/space edit form, render `PriceBreakdown` with a "sample guests" input (default 100) so the manager sees Net, Tax, Gross live while editing. Sample guest count is local UI state, not persisted.

### 5. Deal builder (`deals.$id.tsx`)

- Food and Beverage packages render in two separate cards.
- Each selected package row gains a "Guests" input, defaulting to deal guest count; override persists in the saved proposal config as `package_guest_overrides: { [packageId]: number }`.
- Totals card breaks each line into Net / Tax / Gross using the shared helper, and shows overall Net subtotal, Total tax, Gross grand total (in addition to service charge / discount already there).
- The existing `computeTotals` in `src/lib/pricing.ts` is extended to accept per-item basis + tax and per-package guest overrides, returning `{ net_subtotal, tax_total, gross_subtotal, ... }`.

### 6. Client proposal view (`p.$token.tsx`)

- Render each package/extra/space with its `long_description` (markdown → sanitized HTML via `marked` + `DOMPurify`, both already in the dependency family or installable).
- Show the same Net / Tax / Gross breakdown to the client.

## Technical notes

- Migration uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and backfills `kind='food'` for existing rows.
- `basis` on an item is nullable: `null` = inherit category default from `fee_config`. UI shows this as "Use default (Net 10%)".
- Overrides live in the saved proposal JSON, so historical proposals stay stable if catalog changes.
- Markdown rendering: install `marked` and `isomorphic-dompurify`. Render only inside the read-only client proposal view.

## Out of scope for this pass

- Editing existing sent proposals to add guest overrides retroactively (new proposals only).
- Multi-tax jurisdictions (single tax rate per item).
