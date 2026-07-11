## Scope

Add an optional external link to food and beverage packages, mirroring the existing `details_url` on spaces (e.g. link to a menu PDF or product page).

## Changes

### Migration
- Add `details_url text null` to `public.fb_packages`.

### Catalog editor (`src/components/catalog-packages-page.tsx`)
- Add a `details_url` field to the `CrudList` fields array, type `url`, nullable, with placeholder like `https://…` and hint "Optional link to menu, PDF, or product page." Applies to both food and beverage since both pages share this component.

### Pricing type (`src/lib/pricing.ts`)
- Extend `PackageSel` with `details_url?: string | null` so it flows through queries.

### Client-facing proposal (`src/routes/p.$token.tsx`)
- Fetch `details_url` alongside other package fields.
- Render a small "View details ↗" link next to the package name/description when present (same pattern as spaces).

### Manager deal view
- If the deal builder currently shows a details link for spaces, mirror that treatment for packages when `details_url` is set. Otherwise skip — no behavior change beyond the catalog editor and public proposal.

## Out of scope

- No pricing or selection logic changes.
- No changes to extras (not requested).
