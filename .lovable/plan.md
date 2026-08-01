# Custom widget builder for the analytics dashboard

Users compose their own charts from a curated set of measures, dimensions and filters. Everything is computed client-side from the data the dashboard already loads, and saved into the existing `dashboard_layouts.config` — no migration needed.

## 1. Config shape

Custom widgets live in the same ordered config array as the built-in ones, so they inherit reordering, hiding and sizing from the layout editor:

```text
{
  widget_key: "custom:<id>",
  visible, size, chart_type, date_range_override,
  custom: {
    id, title, measure, dimension,
    filters: { stages[], space_ids[], owner_ids[], event_types[] }
  }
}
```

The widget registry gains a `customDef()` builder that turns a stored custom entry into the same `WidgetDef` shape the shell already renders, so no changes to the layout editor are required. Config normalization is extended to keep custom entries intact instead of dropping unknown keys.

## 2. Curated aggregation engine

New `src/lib/analytics-engine.ts` — pure functions over the already-loaded `deals`, `deal_activities` and `deal_items`. No SQL, no dynamic expressions.

Measures:

```text
leads            count of deals created in range
won_deals        count of deals in a won stage
conversion       won / leads, as %
revenue          Σ estimated_value of won deals (Σ line_total from deal_items where the dimension is item-level)
margin           Σ (line_total − line_cost)   [requires cost permission + deal_items]
margin_pct       margin / revenue             [requires cost permission + deal_items]
avg_deal_size    revenue / won deals
avg_guests       average guest_count
avg_days_to_win  average days from created_at to the won stage change
```

Dimensions:

```text
month              request month
weekday_request    weekday of created_at
weekday_event      weekday of event_date
stage              current deal stage
owner              deal owner
event_type         deal event type
lead_source        source tag
space              deal_items rows of type space
package            deal_items rows of type package
extra              deal_items rows of type extra
staff              deal_items rows of type staff
```

Filters: date range (widget override, else global period), stage, space, owner, event type — all multi-select, empty = no filter.

The engine returns a uniform `{ rows: [{ key, label, value, secondary? }], total, format }` so every chart type renders from one shape.

Compatibility rules enforced in one place (`isCompatible(measure, dimension)`):
- Item-level dimensions (space / package / extra / staff) require `deal_items` rows; margin measures require them too. Selecting an incompatible pair disables it in the dialog with a short reason.
- Deal-level measures grouped by an item dimension attribute the deal's value to each matched item row.

## 3. Chart renderer

New `src/components/analytics-custom-widget.tsx` renders the engine result as bar, line, area, donut, single-number KPI, or a sortable table — reusing the existing Recharts setup, colour palette, currency formatter and `EmptyState`. Value formatting follows the measure (currency, percent, count, days).

## 4. "New widget" dialog

New `src/components/widget-builder-dialog.tsx`, opened from an "Add widget" button in the analytics top bar (also available while in edit mode):

- Title (auto-suggested from measure + dimension, editable)
- Measure select — margin measures hidden entirely when the user cannot view costs
- Dimension select — incompatible options disabled with a reason
- Chart type picker — options narrowed to what the dimension supports (KPI = no dimension needed)
- Filters: stage, space, owner, event type multi-selects, plus a date-range override (defaults to global period)
- **Live preview** rendering the real chart from real data as choices change
- Save appends the widget to the config and persists; Cancel discards

Editing an existing custom widget reopens the same dialog pre-filled (pencil icon in edit mode); deleting removes it from the config.

## 5. Permissions

- Margin / margin % measures are unavailable in the builder and filtered out of the dashboard for users without cost visibility — a saved margin widget simply does not render for them, matching how the built-in cost widgets behave.
- Item-level widgets show a clear "run Rebuild item analytics" empty state when no `deal_items` rows exist yet.

## Technical notes

- `deal_items` is fetched once on the analytics page (via the cost-safe `deal_items_visible` view) and shared with the engine and the existing item widgets, so no extra round-trips.
- All aggregation is O(deals + items) per widget with memoization keyed on the widget config, keeping a dashboard of a dozen custom widgets fast at a few hundred deals.
- Custom widget IDs are generated client-side (`crypto.randomUUID()`); no schema change to `dashboard_layouts`.
