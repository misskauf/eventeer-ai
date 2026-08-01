## 1. Migration — `goals` table

Columns: `id`, `company_id`, `metric` (`net_revenue` | `gross_revenue`), `period_type` (`month` | `quarter` | `year`), `period_start` (date, normalized to the first day of the period), `target` numeric, `owner_id` nullable, `space_id` nullable, `created_by`, `created_at`, `updated_at` (with the existing `set_updated_at` trigger).

- Unique index on (`company_id`, `metric`, `period_type`, `period_start`, `owner_id`, `space_id`) so one target per scope+period.
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`, `ALL` to `service_role`; no `anon`.
- RLS: read for anyone with `has_permission(company_id, 'analytics', 'view')`; write (insert/update/delete) requires `has_permission(company_id, 'settings', 'edit')` — i.e. owners/admins/managers, matching how other settings tables are gated.

## 2. Settings → Goals page

New section `/settings/goals` in the settings sidebar (module `settings`), listing goals grouped by period with:

- Create/edit dialog: metric (net/gross), period type (Monthly default, Quarterly, Yearly), period picker (month/quarter/year selector that writes `period_start`), target amount in company currency, optional salesperson (team members), optional space.
- Duplicate-period detection surfaces an inline "a goal already exists for this scope" message instead of a raw DB error.
- Convenience action: "Copy last period's targets" to bulk-create next month's goals from the current ones.
- Read-only view for users who can see analytics but not edit settings.

## 3. Goal cards on the analytics dashboard

Two additions to the widget registry (`src/lib/dashboard-widgets.ts`):

- Built-in card **"Revenue goals"** — shows every active goal for the current period as compact progress rows.
- Custom card type **`goal`** — a single goal chosen in the card config (goal picker replaces the measure/dimension pickers), sized `sm`/`md`.

Each goal card follows the card-first shell (drag, hide, size, export), except its date range is **locked to the goal's period** (range control shows the period and is disabled, with a hint explaining why).

Card contents:

- Progress bar (gauge for `sm`) showing actual vs target, `% achieved`, and formatted actual/target amounts.
- Pacing line for in-progress periods: `62% of the month elapsed · 71% of goal` plus an **On track / Behind / Ahead** badge (on track when % achieved ≥ % elapsed − small tolerance).
- Completed periods show final achievement only; future periods show "Not started".
- Empty state links to Settings → Goals when no goals exist.
- Clicking a goal opens the existing deal drill-down sheet filtered to the deals behind the actual.

## 4. Actuals calculation

Reuse the existing analytics data path — no new queries:

- Actual = sum over **signed/won deals** (existing `WON_STAGES`) of the accepted proposal's stored totals, via the existing `revenue_net` / `revenue_gross` measures in `src/lib/analytics-engine.ts`.
- Owner-scoped goals filter on `deals.owner_id`; space-scoped goals filter on deal items' `space_id` — both already supported filter paths in the engine.
- A small `goalProgress()` helper computes actual, % achieved, % elapsed, and pacing status.

## Technical notes

- Goals are fetched once per dashboard load with the other analytics data and passed into the cards.
- Config additions (`goal_id` on the card entry) are normalized defensively in `normalizeConfig`, so existing saved layouts keep working; a card pointing at a deleted goal renders an empty state instead of breaking.
- Visibility of goal cards follows the `analytics` module permission; no cost permission involved, since only revenue (not margin) is shown.
