# Grouped catalog editor + table view for Spaces

Make the shared catalog list component support tabbed edit forms and a table layout, then use both on the Spaces page. Food, beverages, extras and staff keep rendering exactly as today (they pass neither new prop).

## 1. Extend `src/components/crud-list.tsx`

**Tabbed form (opt-in)**
- Add `group?: "basics" | "pricing" | "schedule" | "client"` to `Field`.
- If no field declares a group, the form renders exactly as today.
- If any field does, render a tab bar (Basics, Pricing, Schedule, Client-facing) above the fields; only tabs that actually have fields appear. Ungrouped fields fall into Basics.
- All tab panels stay mounted inside the one `<form>`; inactive panels get the `hidden` class so FormData still submits every field. Active tab resets to the first one whenever the dialog opens.
- Save moves into a sticky footer (`sticky bottom-0` with background + top border) and the dialog widens to `sm:max-w-2xl`.

**Table layout (opt-in)**
- Add `columns?: { key: string; label: string; align?: "left" | "right" | "center"; width?: string; cell: (row: T) => ReactNode }[]`.
- When provided, render a table instead of the stacked list: `bg-muted/40` header row, uppercase muted header labels, `whitespace-nowrap` cells, clickable rows that open the edit dialog, and a right-aligned actions cell with pencil + trash whose clicks stop propagation (still hidden when the user lacks edit permission).
- Without `columns`, the existing `render`-based list is untouched.

## 2. Rework `src/routes/_authenticated/catalog.spaces.tsx`

**Table columns:** Space (name + short description), Capacity (standing / seated), Base fee, Min fee, Days, Tax — with a `formatAvailableDays` helper that condenses `[2,3,4,5,6]` into `Tue–Sat`, handles all-seven ("Every day") and empty/null as all seven, and lists non-contiguous days comma-separated.

**Field groups:**
- basics: name, description, capacity_standing, capacity_seated, event_types
- pricing: base_rental_fee, min_rental_fee, cost, basis, tax_rate_pct
- schedule: the merged schedule control
- client: long_description, features, details_url

**Merged Schedule control** replaces `WeekdayPricingEditor` and the separate `available_days` field: one row per weekday with an availability switch plus base and min fee override inputs. It writes two hidden inputs — `available_days` (JSON array) and `weekday_pricing` (JSON object) — so no database change is needed. Fee inputs for closed days are disabled and greyed, and their overrides are stripped from `weekday_pricing` on submit. Null/empty `available_days` is treated as all seven days open.

**Removals:** the inline weekday toggle row in the row renderer, the `toggleDay` function, and the `reloadKey` state.

## Notes
- No changes to `src/styles.css`, theme tokens, or colours; the table uses existing muted/border tokens.
- Day availability is now edited in the dialog rather than inline, so it saves with the rest of the form.
