## Scope

Add filters to the Catalog › Rules page so managers can narrow the rules list by space, day of week, and month.

## Changes

**`src/routes/_authenticated/catalog.rules.tsx`**
- Add a filter bar above the rules list with three controls:
  - **Space** — single-select dropdown listing the company's spaces + "All spaces" option. Matches rules whose `space_ids` is empty (global) or includes the chosen space.
  - **Day of week** — single-select (Sun–Sat) + "Any day". Matches rules whose `days_of_week` is empty or includes the chosen day.
  - **Month** — single-select (Jan–Dec) + "Any month". Matches rules whose `months` is empty or includes the chosen month.
- Store filter state in local `useState`; default = all "Any".
- Since `CrudList` fetches and renders rows internally, refactor the rules list off `CrudList` for this page (or wrap it) so we can filter client-side. Simplest: replace `CrudList` usage with a small local list + reuse the existing `RuleForm` dialog for add/edit/delete. Keeps behavior identical, just adds filtering.
- Add a small "Clear filters" link when any filter is active, and show a "No rules match filters" empty state.

## Behavior

- Filters are additive (AND across the three axes).
- A rule with an empty array on an axis is treated as "applies to all" for that axis (consistent with `pickMinRevRule`), so it shows up regardless of the filter value on that axis.
- Filters are UI-only — no DB or matching-logic changes.
