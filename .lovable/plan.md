## Scope

Extend food & beverage packages so managers can define **how** the guest selects items inside the package, and let the end client make those selections in the public proposal.

## Package configuration (manager side — Catalog › Food / Beverages)

Add new fields to `fb_packages`:
- `selection_mode` — `'fixed' | 'single_group' | 'multi_group'` (default `'fixed'`)
- `selection_groups jsonb` — array of group definitions, each:
  - `label` (text, e.g. "Starters")
  - `max_select` (int, how many the guest can check)
  - `options` (array of `{ label, description? }`)
- Up to **5 groups**. `single_group` mode uses exactly 1 group. `multi_group` allows up to 5.

Editor UI in `PackagesPage` (`src/components/catalog-packages-page.tsx`):
- New "Menu selection" section in the package form:
  - Radio: **Fixed menu** / **Guest chooses (one group)** / **Guest chooses (multiple groups, up to 5)**
  - If not fixed: repeatable group editor with label, "how many can be selected" number, and a list of options (label + optional description). Add/remove groups (cap at 1 or 5 depending on mode). Add/remove options per group.
- Since `CrudList` renders a generic form, extend it minimally with a `custom` field type that accepts a render function, or wrap the package form. Simplest path: add a `custom` field kind to `CrudList` that renders a caller-provided component bound to the row's values.

## Client-side selection (public proposal — `src/routes/p.$token.tsx`)

For each selected package with `selection_mode !== 'fixed'`:
- Render each group with its label and "Select up to N" hint.
- Checkboxes for each option; enforce `max_select` (disable extras once N are checked).
- Persist choices in `proposal_selections` alongside existing per-item notes. Extend the row shape with a `menu_choices jsonb` (per package: `{ [groupLabel]: string[] }`).

Manager view of chosen items appears in the deal page's client-response section (read-only list per package).

## Behavior notes

- Fixed menu = today's behavior, no UI change on the client.
- Pricing is unchanged — selection affects menu content only, not price.
- Empty/invalid selection is allowed at submit (soft validation, warn but don't block) to keep parity with the current proposal flow.

## Technical details

- Migration: add `selection_mode text default 'fixed'`, `selection_groups jsonb default '[]'::jsonb` to `public.fb_packages`.
- Migration: add `menu_choices jsonb default '{}'::jsonb` to `public.proposal_selections`.
- `src/lib/pricing.ts` — no changes (selection is display-only).
- Types regenerate after migration; then wire the editor + client UI.
