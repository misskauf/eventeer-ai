## Goal

Capture what was actually sold on each won deal as one row per item, then use those rows to power item-level revenue, margin, and attach-rate analytics. Costs stay internal and gated.

## 1. Migration: `deal_items`

Columns: `id`, `company_id`, `deal_id`, `proposal_id`, `item_type` (`space|package|extra|staff`), `item_id` (nullable — catalog item may be deleted later), `item_name` (snapshot), `space_id` (nullable, for grouping non-space lines under the booked space), `qty numeric`, `unit_price numeric`, `line_total numeric` (net), `line_gross numeric`, `unit_cost numeric`, `line_cost numeric`, `captured_at`, `created_at`.

Indexes on `(company_id, deal_id)` and `(company_id, item_type, item_id)`. Unique on `(deal_id, item_type, item_id)` so re-snapshot is an upsert.

Access rules:
- Rows readable and writable only by members of the same company (existing `is_member_of` pattern), plus service role.
- Cost columns are not protected by column-level RLS (Postgres RLS is row-level). Instead: a security-definer view `deal_items_visible` that returns `unit_cost`/`line_cost` as NULL unless the caller is owner or their role is in `companies.cost_visible_roles`, backed by a new `can_view_costs(uid)` SQL function. Analytics reads the view; the base table stays company-scoped.

## 2. Snapshot logic

New `src/lib/deal-items.functions.ts` (`createServerFn` + `requireSupabaseAuth`), `snapshotDealItems({ dealId })`:
- Loads the deal, its latest accepted proposal (`proposals.offer`) and the client's `proposal_selections.selection`.
- Expands the selection through the same rules the pricing engine uses (`computeTotals` line output, using `sourceKind`/`sourceId`) so amounts always match the quoted totals — one row per selected space, package (plus its overtime folded into the package row), extra, and staff line. Fees/gratuity/discount lines are skipped.
- Cost: read `cost` from the catalog row (`spaces.cost`, `fb_packages.cost`, `extras.cost`, `staff_roles.cost`) and multiply by the same quantity basis as the price (per person × guests, per hour × hours × count, flat × count, per event for spaces). There is no separate `item_costs` table in this project; the item's `cost` column is the source.
- `space_id` = the booked space on the deal, so packages/extras/staff group under it.
- Deletes rows for that deal that are no longer selected, upserts the rest — so re-running is idempotent.

Triggers for re-snapshot:
- Called when a deal moves to `client_approved` or `signed`.
- Called when the accepted proposal or the client selection changes on an already-won deal.

## 3. Backfill

A one-time owner-only server fn `backfillDealItems()` that runs the same snapshot over every deal currently in `client_approved`, `signed`, or later payment stages. Exposed as a "Rebuild item analytics" button on the Analytics page (owner only) with a result summary (deals processed, rows written). I will run it and report the counts before we treat the item numbers as authoritative.

## 4. Analytics additions

New "Items & margin" section in `src/routes/_authenticated/analytics.tsx`, respecting the existing period filter (by deal event date, falling back to won date):

Always visible:
- Best-selling packages, extras, and staff — count of bookings and € contribution, top 10 each.
- Space bookings count / utilization.
- Attach rate: % of booked deals with ≥1 extra and ≥1 staff line, plus average add-on value per booked deal.

Gated behind `useCanViewCosts()`:
- Revenue and margin per space (grouped bar: revenue, cost, margin).
- Gross margin % overall, over time (by month), and by space.
- Margin € and % columns on the best-seller tables.

When the user cannot see costs, the cost columns come back NULL from the view and those widgets are not rendered at all.

## Technical notes

- Aggregation stays client-side over `deal_items`, consistent with the existing dashboard; a few thousand rows is fine.
- No change to the pricing engine, client proposal page, contract, invoice, or any public server function — costs never enter client-visible paths.
- Snapshot rows are historical: later catalog price/cost edits do not rewrite past bookings unless the deal's accepted proposal itself changes.
