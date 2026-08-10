# Space size + seating arrangements

Add two optional fields to spaces: a free-text size (e.g. "120 m²") and a map of seating style to guest capacity, edited in a collapsible section of the space form.

## 1. Migration

On `public.spaces`:
- `size text` (nullable)
- `seating_capacities jsonb not null default '{}'::jsonb`

No policy or grant changes — existing space policies already cover these columns. Generated types are refreshed after the migration runs.

## 2. Shared seating styles constant

New `src/lib/seating.ts`:

```text
SEATING_STYLES = ["Gala", "Banquet", "Block", "U-Shape", "Rows",
                  "Standing", "Parliamentary", "Circle", "Restaurant/Bar"]
type SeatingCapacities = Record<string, number>
```

Exported so proposals, the client page and briefs can reuse the same list and ordering later.

## 3. Space form (`src/routes/_authenticated/catalog.spaces.tsx`)

- **Size** — a plain text field in the Basics group, placed next to the capacity fields, placeholder `e.g. 120 m²`, nullable.
- **Seating arrangements** — a `custom` field in the Basics group rendering a new `SeatingEditor`:
  - Renders as a collapsed disclosure row (chevron + "Seating arrangements" + a small summary such as "3 styles set" or "Optional"), expanding on click. Collapsed by default every time the dialog opens.
  - Expanded: one row per style from `SEATING_STYLES` with a label and a number input (`min=0`, placeholder "—").
  - Keeps state in the component and writes a single hidden input `seating_capacities` with `JSON.stringify` of the map, so the existing FormData save path needs no change.
  - Blank or `0` entries are omitted from the saved object — a missing style means the arrangement is not offered.
  - Panel stays mounted while collapsed (hidden) so the hidden input always submits.

## 4. Table column

Size is appended to the existing Capacity column cell (e.g. "200 standing / 120 seated · 120 m²"), so no new column is added and the table stays readable.

## Notes
- Nothing else consumes the new fields yet; this prompt is catalog-only.
- Food, beverages, extras and staff pages are untouched.
