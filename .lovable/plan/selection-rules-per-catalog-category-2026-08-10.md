# Selection rules per catalog category

Replace the current two-way "Client selection" control (one / multiple, spaces-food-drinks only) with a four-mode rule per category, covering Space, Food, Beverages, Extras and Staff. Stored in the deal's offer JSON — no database migration.

## The four modes

| Mode | Key | Client sees |
|---|---|---|
| Required — select one | `required_one` | Radio list, one always selected, cannot be emptied |
| Optional — one or none | `optional_one` | Radio list plus a "None" row, may end up empty |
| Multiple | `multi` | Checkboxes, any number including none |
| Fixed — no selection | `fixed` | Read-only list marked "Included", no controls |

Per-item menu/dish selection inside a package still works in every mode, including Fixed.

## 1. Shared helper (`src/lib/selection-modes.ts`, new)

- `CategoryKey = "space" | "food" | "beverage" | "extra" | "staff"`.
- `CategoryMode` union of the four keys above.
- `CATEGORY_MODE_LABELS` and `CATEGORY_MODE_SUMMARY` (one-line manager-facing sentence per mode, e.g. "Client must pick exactly one space.").
- `DEFAULT_CATEGORY_MODES`: space `required_one`, food `required_one`, beverage `optional_one`, extra `multi`, staff `fixed`.
- `resolveCategoryModes(offer, company)`: offer override → company default (existing `client_select_*` columns mapped: `single` → `required_one`, `multi` → `multi`) → `DEFAULT_CATEGORY_MODES`. Company defaults only exist for space/food/beverage; extra and staff fall back to the built-in defaults.

## 2. Proposal builder (`src/routes/_authenticated/deals_.$id.tsx`)

- Replace the existing "Client selection" card with a **Selection rules** card: five rows (Space, Food, Beverages, Extras, Staff), each a dropdown with the four modes, and under each the one-line summary of what the client will experience.
- State `categoryModes` seeded from `offer.category_modes`, else company defaults, else the built-in defaults; saved into the offer as `category_modes`.
- The old `select_mode` key stops being written. Existing deals holding it are read once and mapped forward so nothing breaks.
- The per-item "Optional for client" switches from the earlier optional-items work are removed from the builder; optionality is now a category rule. Existing `optional_items` data is ignored on read.

## 3. Client proposal page (`src/routes/p.$token.tsx`)

- Resolve the five modes once and pass each category's mode down.
- `SingleChoiceSpaces` / `SingleChoicePackages` take `mode: CategoryMode` instead of the current `single | multi`:
  - `required_one` — radio, seeded with the first item, no clear.
  - `optional_one` — radio with an extra "None" row, seeded to the first item, clearable.
  - `multi` — checkboxes, all seeded on.
  - `fixed` — plain rows with an "Included" marker, no radio/checkbox, all items always counted.
- Extras and Staff get the same treatment: extras currently hard-coded to checkboxes and staff currently display-only both become mode-driven, using a shared row renderer.
- The separate "Optional add-ons" card is removed; its behaviour is now covered by `multi`.
- `resolvedSelection` composes from each category's current selection (fixed = all items) plus alternative-group choices, so totals recompute exactly as before.
- Alternative groups keep their own always-pick-one behaviour inside their category and are unaffected by the category mode.

## 4. Settings (`src/routes/_authenticated/settings.fees.tsx`)

The existing "Client selection" rows stay as-is and keep writing `client_select_space/food/beverage`; they now seed new deals through the mapping in step 1. No schema change, no new settings UI in this pass.

## Notes

- No migration; `category_modes` lives in the `proposals.offer` JSON.
- Prompt 22a's fit-filtering of selectable catalog items in the builder is untouched.
