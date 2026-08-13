# Pipeline board: Kanban / List toggle for Deals

Add a Kanban pipeline view next to the existing Deals list, with drag-and-drop stage changes and live updates. No database changes.

## View toggle

- A small Kanban / List switch sits in the Deals header, next to the existing List / Calendar tabs.
- The choice is remembered per user in the browser (localStorage), so the Deals page reopens in the last used view.
- List view stays exactly as it is today (search, filters, archived toggle, row menus).

## Kanban columns

Columns come from the existing stage config, grouped into pipeline columns:

```text
New & contact | Proposal | Changes requested | Client approved | Signed | Payment | Lost
```

Each raw stage maps into one of these columns; legacy stage values map to the same columns so old deals still appear. A column header shows its label, the number of deals in it, and the summed value of those deals (in the company currency).

## Cards

Each card shows: client name (plus company), event date, deal value, and the owner. Clicking a card opens the deal. Cards keep the existing archive / delete menu behaviour where it is cheap to reuse; otherwise the card is click-through only and those actions stay in the list view.

## Drag and drop

- Drag a card into another column to change its stage. The card moves immediately and rolls back on failure.
- Dropping into a grouped column sets the deal to that column's primary stage (e.g. Payment → waiting payment, Proposal → proposal sent). If the deal is already in a stage belonging to the target column, nothing changes.
- Each move writes a history entry on the deal, same as today's stage change.
- Drag is only enabled for users with edit access on Deals; otherwise each card gets a stage dropdown fallback.

## Live updates

The board subscribes to deal changes in real time, so a stage change made elsewhere (client signs, proposal approved, payment received) moves the card without a reload. The board also refetches when the browser tab regains focus.

## Scope and archived deals

- Archived deals are hidden from the board (the board has no archived mode; use the list's archived toggle).
- Users limited to their own records only see their own deals, exactly like the list.

## Technical notes

- New `src/lib/pipeline-columns.ts`: `PIPELINE_COLUMNS` (id, label key, stages[], primaryStage) derived from `STAGE_GROUPS` / `STAGE_ORDER`, plus `columnForStage(stage)`.
- New `src/components/deals-board.tsx`: dnd-kit `DndContext` + droppable columns + draggable cards; uses `useCompanyCurrency`, `money`, `formatEventDate`, `stageToneClass`.
- `deals.index.tsx` keeps the data fetching and `updateStage`, and renders either the existing table or `<DealsBoard>` based on the persisted view state; owner names resolved from `profiles` for the `owner_id` already on deals (added to the select list).
- Realtime: `supabase.channel("deals-board").on("postgres_changes", { table: "deals" }, refresh)` inside a `useEffect` with cleanup, plus a `visibilitychange`/focus refetch.
- Requires enabling realtime on `deals` — if the publication does not already include it, that is a one-line SQL change; otherwise focus-refetch alone covers it.
- Labels added to `src/i18n/en.json` and `de.json`.
