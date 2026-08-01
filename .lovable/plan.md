## Goal

In the Analytics dashboard's edit mode, each custom widget card gets a **Duplicate** action next to Edit and Delete, creating an independent copy with the same measure, dimension, and filters — ready to tweak into a variant.

## Behaviour

- Duplicate appears only on user-built (custom) widget cards, alongside Edit / Delete, and only while edit mode is on. Built-in cards (KPIs, Funnel, Revenue goals, …) stay single-instance since they are identified by a fixed key.
- The copy gets a fresh widget ID, the title `"<original title> (copy)"`, and carries over: measure, dimension, all filters, chart type, card size, and any per-card date-range override.
- It is inserted directly after the original in the grid, so it appears right where the user clicked.
- Original and copy are fully independent afterwards — editing one does not touch the other.
- Follows the existing save behaviour: while in edit mode the change goes into the unsaved draft (applied on Save), otherwise it persists immediately, same as Delete does today.
- A short toast confirms: "Widget duplicated."

## Technical notes

- `src/routes/_authenticated/analytics.tsx`: add a `duplicateCustomWidget(key)` helper next to `deleteCustomWidget`. It finds the entry, clones `entry.custom` with `crypto.randomUUID()` and the `(copy)` title, builds a new `WidgetConfig` with `widget_key = custom:<newId>` reusing `chart_type`, `size`, `filters`, and `date_range_override`, and splices it in after the source index. Render a Copy-icon button in the existing `editActions` block for custom entries.
- No changes to `dashboard-widgets.ts`, the engine, or the database — the layout config already stores custom widgets as a list, and `normalizeConfig` accepts the new entry as-is.
