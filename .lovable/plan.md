## Scope

Add a **Calendar** view under Deals that shows all deals on their `event_date`, color-coded by stage, and surfaces same-date conflicts when opening a deal.

## Stage color mapping (new, calendar-specific)

Applied to calendar entries only; existing table chips keep their current tones.

| Stage | Color |
|---|---|
| new | white (bordered) |
| contacted | light grey |
| meeting_scheduled | dark grey |
| proposal_sent | blue |
| signed | yellow |
| waiting_payment | orange |
| invoice_sent | orange |
| downpayment_received | light green |
| paid_in_full | green |
| payment_delayed | red outline |
| lost | red |

Added to `src/lib/deal-stages.ts` as a separate `STAGE_CALENDAR_TONES` map so table styling stays untouched.

Conflict severity split:
- **Hard conflict (red `!`)**: any other deal on the same date with stage `signed`, `waiting_payment`, `invoice_sent`, `downpayment_received`, `paid_in_full`, or `payment_delayed`.
- **Soft warning (orange △)**: any other deal on the same date with stage `new`, `contacted`, `meeting_scheduled`, or `proposal_sent`.
- `lost` deals are ignored.

## Changes

### 1. Deals layout with tabs
Convert `src/routes/_authenticated/deals.tsx` into a layout route rendering `<Outlet />` with two tabs: **List** and **Calendar**. Move existing table content into `src/routes/_authenticated/deals.index.tsx` (URL stays `/deals`). Add `src/routes/_authenticated/deals.calendar.tsx` (URL `/deals/calendar`).

Note: existing `deals_.$id.tsx` uses the `_` suffix so it stays outside the new layout — the detail page won't inherit the tab bar. Good.

### 2. Calendar page (`deals.calendar.tsx`)
- Month grid, prev/next/today controls, defaulting to current month.
- Fetch all deals with non-null `event_date` for the visible month range, selecting `id, client_name, client_company, event_date, stage`.
- Render each deal as a small pill inside its day cell: `{company_name || client_name} · {client_name}` (company first per spec; fall back to client name when no company). Pill background uses `STAGE_CALENDAR_TONES[stage]`.
- Clicking a pill navigates to `/deals/$id`.
- Show a color legend below the grid.
- Lightweight, no calendar lib — plain CSS grid (7 cols) using `date-fns` (already available via existing usage) or native Date math.

### 3. Conflict indicators in deal detail (`deals_.$id.tsx`)
At the top of the deal page (near the event date field), if the deal has an `event_date`:
- Query other deals in the same company with the same `event_date`, excluding self and `lost`.
- If any match is in the hard-conflict stage set → red `!` badge: "Conflict: N signed/paid event(s) on this date" with clickable links.
- Else if any match is in the soft set → orange △ badge: "N deal(s) in negotiation for this date".
- Otherwise render nothing.

## Out of scope

- Week/day views, drag-to-reschedule, ICS export.
- Changing existing table stage chip colors.
- Conflict indicator inside the list/table view or the calendar cells themselves (only shown when entering a specific deal, per request).

## Technical notes

- New route files under `src/routes/_authenticated/` — TanStack file-based routing auto-generates the tree.
- Parent layout uses `deals.tsx` with `<Outlet />`; index leaf `deals.index.tsx` holds the current table code verbatim (just relocated).
- Calendar tones live alongside existing `STAGE_TONES` to avoid regressing the table.
