
## Adjustments to the deal / proposal builder

All changes are scoped to the deal detail page (`src/routes/_authenticated/deals_.$id.tsx`), the client proposal page (`src/routes/p.$token.tsx`), and one small schema addition for space availability.

### 1. Event date shows the weekday
Format `event_date` everywhere on the deal page as e.g. `Sat, 14 Jun 2025` (using `toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })`). Apply to the page header subtitle and the "Event date" detail cell.

### 2. Replace "season" picker with auto-applied minimum revenue rule
- Remove the manual **Season** dropdown and the `seasonId` state.
- On load, query `pricing_rules` for the deal's company. When the deal has an `event_date`, pick the rule whose `days_of_week` contains the event's weekday AND whose `months` contains the event's month (fallback: first match on weekday only, then global default).
- Show a small read-only banner in the proposal editor: `Applied rule: <name> · Min revenue <amount> (<basis>)` with the matched rule.
- Auto-set `minRevenue` from the matched rule; keep the shortfall indicator that already exists.
- `season_multiplier` collapses to `1` (kept in the offer JSON for back-compat) since seasons are no longer selectable here.

### 3. Service charge slider
- Replace the single "service charge %" number with a **0–20% slider** (shadcn `Slider`, step 0.5) plus a numeric input mirror.
- Directly beneath, show a read-only row: `Service charge (X%) = <computed money>` recomputed from `totals.net_subtotal`.
- The slider value overrides `fees.service_charge_pct` for the current proposal (persisted inside `offer.fees_override.service_charge_pct`); catalog defaults are untouched.

### 4. Auto cover title
- When `coverTitle` is empty and the deal has `event_type` + `event_date`, auto-fill it as `"<Event type> · <formatted date>"` (e.g. `"Wedding · Sat, 14 Jun 2025"`).
- Regenerate whenever the deal's event type or date changes AND the manager hasn't manually typed one (tracked via a `coverTitleTouched` flag).

### 5. Suggested offer text
- Add a **"Suggest text"** button next to the intro-markdown editor.
- Clicking it inserts a template built from the current selections, e.g.:
  ```
  Dear <client>,

  Thank you for considering us for your <event type> on <formatted date>.

  We are pleased to propose:
  - Space: <space names>
  - Food: <food package names>
  - Beverages: <beverage package names>
  - Extras: <extra names>

  Estimated total: <grand total>.
  ```
- Only overwrites the intro if empty; otherwise appends after a divider. All values come from current `selectedSpaces` / `selectedPackages` / `selectedExtras` / `totals`.

### 6. Space filtering by day of week / date
- Add an `available_days integer[]` column to `public.spaces` (default `ARRAY[0,1,2,3,4,5,6]` so existing spaces stay available every day). Same migration keeps existing GRANTs.
- In the deal builder, when the deal has an `event_date`, filter the spaces list to those whose `available_days` includes the weekday. Spaces not available on that day are hidden from the "Spaces" section AND from the alternative-group space picker.
- On the catalog spaces page, add a small multi-select of weekdays so managers can configure this (reusing the weekday helper already in `catalog.rules.tsx`).

### 7. Optional discount
- Hide the discount input by default behind an **"Add discount"** toggle/link. When toggled off, `discount` is `0` and not shown in the totals breakdown.
- When toggled on, show the existing number input; the totals card also only renders the "Discount" line when `discount > 0`.

---

### Technical notes

- Weekday helper: `new Date(event_date).getDay()` (0 = Sunday) — matches the convention already used in `catalog.rules.tsx`.
- Schema migration adds only `spaces.available_days`; no other tables change. Existing proposals continue to render because `season_id` remains an optional field in `offer`.
- No pricing engine changes needed for items #1, #2, #4, #5, #6, #7. Only #3 needs `computeTotals` to receive the overridden `service_charge_pct` — done by threading the override into `offer.fees` before calling `computeTotals`.
- Client page (`p.$token.tsx`): pick up the new `cover_title`, honour the persisted service-charge override (already flows through `offer.fees`), and skip the discount line when zero. No new client-side controls.
