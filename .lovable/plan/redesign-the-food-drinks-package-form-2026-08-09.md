# Redesign the Food & Drinks package form

Reorganise the add/edit dialog used by both catalog pages (Food and Drinks) into clearly labelled sections, and turn the selection-mode picker into three visual cards with wording that matches food vs drinks. No pricing math changes.

## Section layout (both kinds)

1. **Basics** — Name, Short description, Suits event types (tag input stays as-is).
2. **Pricing** — Price per person, Price basis, Tax rate %.
3. **Cost (internal)** — Internal cost per person. Only rendered when the user can view costs, with a note "Not shown to clients."
4. **Event hours** — Drinks only: Standard hours included, Overtime price per guest / hour.
5. **For how many guests** — Minimum guests + Maximum guests side by side. Hint: "Used to match this menu to an event's guest count." Blank maximum = no upper limit.
6. **Menu selection** (food) / **Package selection** (drinks) — the selection editor.
7. **Details (optional)** — Full details, Link to package details.

## Food vs Drinks differences

| | Food | Drinks |
|---|---|---|
| Hours fields | removed from form and from the list display line | kept, in "Event hours" |
| Selection title | Menu selection | Package selection |
| Mode labels | Fixed menu / Dishes selection (1 group) / Dishes selection (multiple groups) | Fixed package / Drinks selection (1 group) / Drinks selection (multiple groups) |
| Item wording | "Add dish", "Dish name" | "Add drink", "Drink name" |

The hours DB columns stay untouched; food rows simply stop editing/showing them.

## Visual mode picker

The three pill buttons in the selection editor become three selectable cards in a responsive grid — each with an icon, a title, and a one-line description (e.g. "Served as-is, no guest choice" / "Guests pick from one list" / "Groups like Starters, Mains, Desserts"). The selected card gets the existing primary border/tint treatment; no new colours. Stored `selection_mode` values remain `fixed`, `single_group`, `multi_group`, so existing rows keep working.

## Technical notes

- `CrudList` currently groups fields into *tabs* via `group`. For this form we want stacked labelled sections, so add a lightweight optional `section?: string` on `Field` plus an optional `sectionOrder?: string[]` prop. When any field has a section, fields render in stacked blocks with a small uppercase muted header (same style as the table headers already in `crud-list.tsx`) and a divider. No section = today's behaviour; tab grouping is untouched, so Spaces is unaffected.
- All fields stay mounted inside the single `<form>` (sections are stacked, nothing hidden), so FormData is unaffected.
- `menu-selection-editor.tsx` gains optional wording props: `title`, `modeLabels`, `itemNoun` (defaults keep current strings), passed from `catalog-packages-page.tsx` based on `kind`.
- Add `max_guests` field (nullable number) to the packages form; the column already exists in `fb_packages`.
- Food list line drops the "…h included" and overtime segments; drinks list line is unchanged.
- Pricing helpers (`resolveBasis`, `resolveTaxRate`, `PriceBreakdown`, cost/margin) are reused untouched.
