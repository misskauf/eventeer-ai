## Goal
In Catalog → Spaces, allow setting a different base/min rental fee per day of the week, instead of only a single flat price. The existing single-price fields remain as the default fallback for days that don't have an override.

## UX
On each space's edit form, below the existing "Base rental fee" and "Minimum rental fee" fields, add a new "Price per weekday" section:

- A compact 7-row editor (Sun–Sat). Each row has two inputs: Base fee and Min fee.
- Leaving a row blank = use the default fees above for that day.
- A small hint: "Overrides the default fees for the selected day."

In the space card list, if any weekday overrides exist, show a subtle line like "Custom pricing: Fri, Sat" under the fee summary.

## Data model
Add a JSONB column `weekday_pricing` on `public.spaces`:

```
{ "5": { "base": 2000, "min": 1500 }, "6": { "base": 2500, "min": 2000 } }
```

Keys are `0`–`6` (Sun–Sat). Values may include `base`, `min`, or both. Missing days fall back to `base_rental_fee` / `min_rental_fee`. No new table needed; keeps everything colocated with the space.

## Pricing engine
Update `src/lib/pricing.ts`:

- Add optional `weekday_pricing` to `SpaceSel`.
- Add optional `event_date` (ISO string) to `Selection` (already implicitly known on deals — the deal has a date).
- In `computeTotals`, when computing a space line, if `event_date` is set and `weekday_pricing[dow]` exists, use those overrides for `base_rental_fee` / `min_rental_fee`; otherwise fall back to the current values.

## Deal + proposal wiring
- `src/routes/_authenticated/deals_.$id.tsx` (deal builder) and `src/routes/p.$token.tsx` (client proposal) already have a deal event date — pass it into `computeTotals` as `selection.event_date`.
- Catalog preview in `catalog.spaces.tsx` keeps showing the default fees (no date context there).

## Files touched
- Migration: add `weekday_pricing jsonb` to `public.spaces` (nullable, default `'{}'::jsonb`).
- `src/lib/pricing.ts`: type + weekday resolution.
- `src/routes/_authenticated/catalog.spaces.tsx`: new field type in the `CrudList` (or a small inline editor) + list-card summary.
- `src/components/crud-list.tsx`: add a `weekday_pricing` field renderer (7-row grid) if we go through CrudList; otherwise render it as a custom section.
- Deal builder + public proposal: forward `event_date` into pricing calls.

## Out of scope
- Per-weekday pricing for packages/extras (only spaces for now).
- Time-of-day pricing.
- Season interaction changes — the existing season multiplier still applies on top of the resolved weekday price.
