# Deals filters: date presets, space filter, no persistence

## Date range control

Replace the two manual "Event from / Event to" inputs with a single preset dropdown:

```text
Any date (default) | This week | Last week | This month | Last month
This year | Last year | Future events | Exact dates
```

- Presets compute a from/to pair on the fly (week starts Monday, ranges are inclusive).
- "Future events" = event date from today onward, no upper bound.
- "Exact dates" reveals the two date inputs that exist today, so manual ranges are still possible.
- Deals with no event date are excluded whenever a date filter is active.

## Space filter

New "Space" dropdown next to Owner, listing the workspace's spaces (active ones, by name) plus "All spaces". Selecting a space keeps only deals that have a line item for that space.

Since the deals table itself has no space, the page also loads the space references for the deals in view (`deal_items` rows with a `space_id`) and matches against that set.

## Owner and value

Owner filter and minimum value stay exactly as they are.

## No persistence

Filters (date preset, owner, space, min value, search) always start empty on each visit — nothing is written to localStorage or the URL. The Kanban / List view toggle keeps its existing per-user persistence.

Both Kanban and List views use the same filtered result, and the reset button clears all of the above.

## Technical notes

- `src/routes/_authenticated/deals.index.tsx`: swap `dateFrom`/`dateTo` state for `datePreset` plus the existing two inputs used only in `exact` mode; add a small `presetRange(preset)` helper returning `{ from, to }` (or open-ended).
- Add `spaceFilter` state; fetch `spaces (id, name)` for the dropdown and `deal_items (deal_id, space_id)` for the currently loaded deals, reduced to `Map<dealId, Set<spaceId>>` and refreshed alongside `refresh()`.
- Extend the `filtered` memo and `hasActiveFilters` check with the new preset and space conditions.
- New labels added to `src/i18n/en.json` and `de.json` under the existing `deals.filter_*` keys.
