# Customizable, persistent Analytics dashboard

Adds a saved layout per user around the existing charts. The charts themselves stay exactly as they are today.

## 1. Migration — `dashboard_layouts`

Columns: `id`, `company_id`, `user_id` (nullable — a NULL row is the company default), `config` jsonb (default `'[]'`), `created_at`, `updated_at` (with the existing `set_updated_at` trigger). Unique on `(company_id, user_id)`.

Access rules:
- Members of a company can read their own row and the company default row.
- A member can create/update/delete only their own row.
- Only users with admin on the settings module can write the company default row.
- Standard grants for signed-in users and backend services.

`config` shape (ordered array):

```text
[{ widget_key, visible, chart_type, size: "sm" | "md" | "lg", date_range_override }]
```

`date_range_override` is either `null` (follow the global period) or `{ mode, from, to }`.

## 2. Widget registry

New `src/lib/dashboard-widgets.ts`: one entry per widget with its key, label, allowed chart types, default size, and whether it requires cost visibility.

Widgets: KPI row, leads over time, sales funnel, deal status, revenue over time, by weekday, event revenue by month, velocity, sales rep performance, item analytics, internal revenue quality (cost-gated).

A `defaultConfig()` helper produces the current dashboard order so existing users see no change on first load.

## 3. Refactor charts into self-contained widgets

Split the current `analytics.tsx` body into `src/components/analytics/*.tsx`, one component per widget. Each receives the shared dataset (deals, activities, proposals), the global period, and its own config entry, and renders inside a card with its existing per-widget range and chart-type controls — now seeded from and written back to the saved config.

`analytics.tsx` becomes: data fetch → resolve config → map over the ordered config → render visible widgets in a responsive grid, where `size` maps to column span (sm = 1, md = 2, lg = full).

## 4. Edit mode

An "Edit dashboard" toggle in the top bar switches each card into an edit chrome:
- Reorder with dnd-kit (already commonly available; if the install is a problem the fallback is up/down arrow buttons — same config write either way).
- Show/hide switch per widget, plus a panel listing hidden widgets so they can be brought back.
- Chart-type picker per widget (only the types that widget supports).
- Size picker (S / M / L).
- Save, Cancel, and "Reset to default" (deletes the user row so the company default, then the built-in default, applies).

Edits are local until Save; Save upserts the user's `dashboard_layouts` row.

## 5. Permissions

Cost-gated widgets are filtered out of both the dashboard and the edit-mode widget list when `useCanViewCosts()` is false, regardless of what a stored config says — so a saved layout can never leak margin data after a permission change. The whole route keeps its existing analytics-module guard.

## Technical notes

- Config is read through a small `useDashboardConfig()` hook: fetch user row → company default row → built-in default; it also validates unknown widget keys out and appends newly added widgets at the end so future widgets show up automatically.
- Writes go through a server function with the usual auth middleware; no admin client needed.
- No change to data fetching or chart computation, so performance is unchanged.
