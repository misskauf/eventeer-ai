# Adjustable service charge + multi-item discounts

## 1. Service charge per deal (builder)

The builder already stores a per-deal service charge in `offer.service_charge_pct_override` and shows a slider. What's missing is the "this differs from your default" feedback.

- Keep the existing slider (and the fixed-rate note when pricing rules force a fixed gratuity).
- Track the company default (from pricing rules: fixed pct, or default/service charge pct) alongside the current value.
- When the current value differs from the default, show a subtle "Overridden (default X%)" hint plus a "Reset to default" link that puts the slider back and clears the override.
- When it equals the default, save `service_charge_pct_override` as null so the deal follows future settings changes; the client page already falls back to the company default in that case.

## 2. Discounts on multiple items

New `offer.item_discounts`, a map keyed by line item id:

```text
item_discounts: { "<item-id>": { type: "pct" | "amount", value: number } }
```

Keys are the catalog item ids already used as `sourceId` on quote lines (space, food/beverage package, extra, staff). A package's overtime line inherits its package's discount.

### Builder UI (in the fees/discount card, near totals)

- A compact "Item discounts" block listing every currently priced line with a checkbox, its gross amount, and its current discount (if any).
- Above the list: a type toggle (% / fixed amount), a value input, and an "Apply to selected" button — so several items get the same discount in one action.
- Each row also shows an inline "x" to clear that item's discount.
- Percentage capped 0-100; fixed amounts capped at the line gross.
- The existing single "Apply a discount (optional)" overall/targeted discount stays exactly as it is and keeps working alongside item discounts.

### Pricing engine (`src/lib/pricing.ts`)

- `Offer` gains `item_discounts?: Record<string, { type: "pct" | "amount"; value: number }>`.
- After lines are built and before the targeted/global discount and gratuity, each line whose `sourceId` has a discount gets reduced: compute the gross reduction (pct of line gross, or the fixed amount capped at line gross), set `original_gross/original_net/original_tax` and `discount_applied`, and re-derive net/tax from the line's own tax rate — the same mechanism the current targeted discount uses.
- Net subtotal, tax subtotal and gratuity are then computed from the reduced lines, so service charge and tax follow the discounted amounts.
- `Totals` gains `item_discount_total` (gross) and `item_discount_net`, summed across discounted lines; the existing `discount` / `discount_net` fields keep meaning the targeted-or-global discount only.

### Display

- Builder quote panel and client proposal page: each discounted line already renders `· discount -X` from `discount_applied`; extend it to show the percentage when the discount was a percentage.
- Both totals blocks get an "Item discounts" row (`-amount`) above the existing discount row when `item_discount_total > 0`, and the net-side reduction under the net subtotal.
- Client page loads `offer.item_discounts` from the saved offer and feeds it into `computeTotals`, so client-side re-computation on optional/alternative switches keeps the discounts.

## Notes

- No database migration — everything lives in the existing offer JSON.
- Invoices/contracts read the computed totals, so they inherit the reductions automatically.
