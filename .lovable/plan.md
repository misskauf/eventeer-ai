## Goal

Let each workspace define, in **Catalog → Pricing rules**, how gratuity works:

- **Type**: *Service charge* (net, default 19% tax) or *Tip* (0% tax).
- **Rate mode**: *Fixed* (locked %) or *Slider* (client chooses within a min–max range).
- **Values**: percentage (fixed) OR min / max / default (slider), plus editable tax rate for service charge.

The Deal Builder and the client-facing proposal then reflect this: label ("Service" vs "Tip"), the correct tax treatment, and either a locked % or the slider bounded to the configured range.

## Changes

### 1. Database (migration)

Extend `fee_config` (single row per company) with:

- `gratuity_type` text — `'service_charge' | 'tip'`, default `'service_charge'`.
- `gratuity_mode` text — `'fixed' | 'slider'`, default `'slider'`.
- `gratuity_fixed_pct` numeric — used when mode = `fixed`.
- `gratuity_min_pct` numeric — slider min (default 0).
- `gratuity_max_pct` numeric — slider max (default 20).
- `gratuity_default_pct` numeric — slider starting value (default = existing `service_charge_pct`).
- `gratuity_tax_rate_pct` numeric — tax rate for service charge (default 19). Ignored when type = `tip`.

Backfill from the current `service_charge_pct` so existing workspaces keep their behavior.

### 2. Catalog → Pricing rules UI (`src/routes/_authenticated/catalog.rules.tsx`)

Add a new **Service & tip** card above Seasons:

- Segmented control: *Service charge (taxed)* / *Tip (untaxed)*.
- If service charge → number input for tax rate % (default 19).
- Segmented control: *Fixed rate* / *Client slider*.
- Fixed → single % input.
- Slider → min %, max %, default % inputs.
- Save writes to `fee_config`.

### 3. Pricing engine (`src/lib/pricing.ts` + `src/lib/tax.ts`)

Extend `Offer.fees` with the gratuity config. Replace the current single `service_charge` calculation:

- Compute `gratuity_amount = net_subtotal * pct / 100`.
- If type = `service_charge`: add a taxed line (basis `net`, rate = `gratuity_tax_rate_pct`) so tax subtotal picks it up.
- If type = `tip`: add an untaxed amount (added to grand total, not to tax subtotal).
- Expose `gratuity_label` (`"Service"` or `"Tip"`) and keep `service_charge` field for back-compat (= gratuity gross).

### 4. Deal builder (`src/routes/_authenticated/deals_.$id.tsx`)

- Load gratuity config from `fee_config` alongside existing fees.
- Replace the fixed 0–20% slider with one bounded by `gratuity_min_pct`–`gratuity_max_pct` when mode = slider; when mode = fixed, hide the slider and show the locked % as read-only.
- Label the row "Service" or "Tip" based on type; show computed amount and tax impact underneath.
- Persist the chosen % into the existing offer override (`service_charge_pct_override`); if fixed mode, always use the fixed value.

### 5. Public proposal (`src/routes/p.$token.tsx`)

- Same behavior: honor override only within min–max; render slider or fixed row per config; label matches type; totals reflect tax vs no-tax.

### 6. Settings page

Remove the now-duplicate `service_charge_pct` field from `src/routes/_authenticated/settings.tsx` (or leave it as the migrated default) — it's fully superseded by the new Pricing-rules card.

## Notes

- No breaking change for existing deals: migration seeds gratuity fields from current `service_charge_pct`, and `computeTotals` continues to expose `service_charge`.
- Tip does not affect tax subtotal; service charge does (line item taxed at the configured rate, basis net).
