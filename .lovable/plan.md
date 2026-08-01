## What already exists (reuse, don't rebuild)

- `dashboard_layouts` table (per user + company-default fallback), persisted config, reset-to-default.
- `deals.source` column (`manual` / `lead_form`), already set by the lead form.
- Analytics page with dnd-kit reorder, per-card size, hide/show, per-card date range, chart-type switch, custom widget builder, and the curated aggregation engine (`src/lib/analytics-engine.ts`).
- "Analytics" already in the sidebar (`app-shell.tsx`, gated by the `analytics` module).
- Cost/margin cards already gated by cost permission.

So **no migration is needed** — both migration items from the brief are already live. The work below closes the remaining gaps.

## 1. Revenue: net vs gross

- Extend the engine with two measures: `revenue_net` and `revenue_gross`, read from the accepted proposal's stored totals (fall back to `estimated_value` when no accepted proposal exists).
- Update the built-in "Revenue over time" card to plot both series, with a per-card toggle for net / gross / both.

## 2. Compare vs previous period

- Add `compare_previous: boolean` to the card config (normalizer defaults it to `false`, so old layouts stay valid).
- Helper computes the immediately-preceding equivalent window from the card's resolved range.
- Line/area/bar cards overlay a dashed "previous" series; KPI cards show a % change badge (green/red, neutral when the previous value is 0).
- Toggle lives on the card header, next to the range control.

## 3. Per-card filters for built-in cards

Today only custom widgets have filters. Add a compact "Filters" popover to every card header exposing: F&B package, space, stage, source (lead vs deal), owner, event type. Selections persist into the card's config entry and feed the same filter path the engine already uses.

## 4. Drill-down

- Clicking a bar / donut segment / table row opens a sheet listing the deals behind that number (client, event date, stage, owner, value) with a link to each deal.
- One shared `DealDrilldownSheet` component; each card passes the predicate that produced the clicked slice.

## 5. Export

- **CSV**: header button exports every visible card's underlying rows as one CSV (card title as a section header), plus a per-card "Export CSV" item in edit mode.
- **PDF**: print-to-PDF snapshot reusing the existing print approach from contracts/invoices, with a print stylesheet that expands the grid to one card per row and hides controls.

## 6. Polish

- Empty states per card ("No data in this period"), consistent Recharts tooltips, and a responsive grid check at mobile / tablet widths.

## Technical notes

- Config additions are additive and normalized defensively in `normalizeConfig`, so existing saved layouts load unchanged.
- Drill-down and CSV reuse the same in-memory dataset already fetched by the page — no extra queries.
- Margin/cost measures stay behind `useCanViewCosts()`; drill-down and CSV strip cost columns for users without that permission.

No app-wide redesign; all changes stay inside the analytics page, its widget components, and the engine.
