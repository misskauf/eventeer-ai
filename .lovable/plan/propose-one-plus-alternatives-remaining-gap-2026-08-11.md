# Propose-one-plus-alternatives — remaining gap

Most of this model is already live: each category header has a compact inline mode dropdown (Required one / Optional one / Multiple / Fixed) plus an "Alt on/off" collapsible toggle, items carry a small star to mark the proposed pick, the builder quote sums only the proposed pick per single-choice category, and the client page pre-selects the recommendation with alternatives as radios.

The one missing piece is the **"Default: [item] / None"** choice for *Optional — one or none* categories. Today an optional-one category always falls back to pre-selecting the first item, so a manager cannot open the client on "None".

## Changes

**src/lib/selection-modes.ts**
- Add `resolveNoneDefaults(offer)` reading `offer.none_defaults` (per-category booleans, default false).
- `chargeableIds(...)` gains an optional `noneDefault` flag: for `optional_one` with the flag on, return `[]` (nothing charged by default).

**src/routes/_authenticated/deals_.$id.tsx**
- New `noneDefaults` state, loaded from the offer and saved as `none_defaults` alongside `category_modes` / `primary_ids` / `offer_alternatives`.
- In `ModeInline`, when mode is `optional_one`, show a tiny inline "Default: Proposed / None" select (h-7, text-xs) next to the mode dropdown — no new panel, no extra rows.
- Feed the flag into the quote computation so an Optional category defaulting to None contributes 0 to the Event quote.

**src/routes/p.$token.tsx**
- Read `none_defaults`; when set for an optional-one category, seed the client's selection empty (the "None" row is already rendered) so the total excludes it until they pick.

No migration, no schema change — everything lives in the existing offer JSON.
