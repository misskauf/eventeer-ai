## Goal

Change the client-facing proposal page (`/p/:token`) so that the manager's base picks drive the client's choice UI:

- **Spaces**: if the manager included several, the client picks exactly one (radio). If only one, it is shown as included with no choice. At least one must be selected — no "opt out".
- **Food packages**: same as spaces (single choice / required).
- **Beverage packages**: same as spaces (single choice / required).
- **Extras**: multi-choice (checkboxes) — client picks zero, one, or many. Unchanged.
- **Beverage package hours**: the client can bump the number of hours on the chosen beverage package; extra hours flow into the existing overtime line in the quote.

The manager-side deal builder is not changed. What they already do (adding one or several items per category) becomes the source of truth for how the client sees it.

## Changes

### 1. `src/routes/p.$token.tsx` — client proposal view

- Replace the "base multi-select" sections for **Spaces**, **Food**, and **Beverages** with single-choice logic:
  - If the manager provided 1 item → render it as an "included" card (no toggle), and force it into the selection.
  - If the manager provided >1 → render a radio group; default to the first item; client must keep exactly one selected.
- Keep the existing "Alternative groups" section as-is (already single-choice) so proposals built with explicit alt-groups still work.
- Keep **Extras** as multi-choice checkboxes.
- On the selected beverage package card, add a small "Event hours" numeric input (min = `included_hours`, defaults to `included_hours`). Store the value in `packageHours` state, pass it into the `Selection.package_hours` map, and it will flow through `computeTotals` (already supports per-package overtime).
- Update `submitClientSelection` payload to include `package_hours`.

### 2. `src/lib/public-share.functions.ts` — token submit

- Extend the Zod schema for `submitClientSelection.selection` to accept `package_hours: z.record(z.string(), z.number()).optional()` and pass it through when writing `proposal_selections.selection`.

### 3. No schema, RLS, or manager-side changes

- `Selection.package_hours` already exists in `src/lib/pricing.ts`.
- `PackageSel.included_hours` and `overage_price_per_person_per_hour` already exist and are already fetched server-side.

## Out of scope

- Deal builder UI (manager side).
- Any new backend tables or migrations.
- Persisting the client's `package_hours` back onto the deal record beyond what's already stored in `proposal_selections.selection`.

## Verify

1. Manager creates a proposal with 2 spaces, 2 food packages, 1 beverage package, 2 extras → open "Preview as client":
   - Spaces show as radio (pick one, required).
   - Food shows as radio (pick one, required).
   - Beverage shows as included card + "Event hours" input.
   - Extras show as checkboxes (any subset).
2. Increase beverage hours above `included_hours` → quote shows an overtime line and grand total updates.
3. Manager creates a proposal with 1 space / 1 food / 1 beverage → each shows as an included card, all in the quote.
