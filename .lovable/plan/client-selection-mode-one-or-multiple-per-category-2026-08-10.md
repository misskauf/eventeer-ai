# Client selection mode: one or multiple per category

Let the venue decide whether a client picks **one** or **several** spaces / food menus / drinks packages on the proposal — globally in Settings, with a per-deal override in the proposal builder.

## 1. Migration

Add three text columns to `companies`, each `single` or `multi`, default `single`:

- `client_select_space`
- `client_select_food`
- `client_select_beverage`

A check constraint limits values to those two. No other schema change — the per-deal override lives in the proposal's existing JSON.

## 2. Settings UI

New "Client selection" card on **Settings → Fees & taxes**, above the tax sections:

- Spaces — "Client selects one" / "Client selects multiple"
- Food — same
- Drinks — same

Each is a two-option control with a one-line hint: "Multiple works like extras — everything the client ticks is added to the total." Saved together with the existing fee form (single Save), writing to `companies`.

## 3. Per-deal override (proposal builder)

In `src/routes/_authenticated/deals_.$id.tsx`, a compact "Client selection" row near the offer sections with three selects — Spaces / Food / Drinks — each `Use default` / `One` / `Multiple`. Each shows the inherited company default in the "Use default" label (e.g. "Use default (One)").

Stored in the offer JSON:

```text
offer.select_mode = { space?: "single" | "multi", food?: ..., beverage?: ... }
```

Absent key = follow the company default. No migration needed.

## 4. Client proposal page

Resolution order per category: `offer.select_mode[cat]` → company column → `single`.

- **single** — today's radio-group behaviour, unchanged.
- **multi** — the same rows render as checkboxes; every ticked item counts toward the running total, exactly like extras. Default state: all base items in that category start ticked.

Unchanged in both modes:

- "Choose one" alternative groups stay pick-one.
- Optional items (Prompt 21) stay in the "Optional add-ons" card with their `default_on` state.
- Extras and staff behave as today.
- Submission shape is the same (`space_ids` / `package_ids` / ...), so CRM reconciliation needs no change. Preview mode preserved.

Edge case: in multi mode a client may untick everything in a category; the total simply drops that category (no forced minimum).

## Technical notes

- `resolveProposal` in `src/lib/public-share.functions.ts` already returns the whole `company` row, so the three new columns reach the client page automatically.
- On `p.$token.tsx`, `selSpaces` / `selFoodPkgs` / `selBevPkgs` are already string arrays, so multi mode is a rendering + seeding change; `resolvedSelection` and `computeTotals` are untouched.
- `SingleChoiceSpaces` / the package single-choice component gain a `mode` prop and render `Checkbox` rows instead of `RadioGroup` when `mode === "multi"`, reusing the same row markup and price display.
- Header wording switches from "Choose one" to "Choose any" in multi mode.
