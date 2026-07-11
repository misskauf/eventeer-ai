## Two related changes

### 1. Discount applies to a chosen line (gross), shown as net in totals

Today `discount` is subtracted from the gross grand total as an opaque flat amount. Change to:

- **Manager picks a target line** for the discount (a specific selected space, package, or extra — not "the whole proposal"). Store `discount_target` = `{ kind: "space" | "package" | "extra", id: string }` alongside `discount` (gross amount) in `proposal.offer`.
- **`computeTotals` (in `src/lib/pricing.ts`)** applies the discount inside that single line: reduce that line's `gross` by the discount amount (capped at the line's gross), then re-derive its `net` and `tax` from the line's own `basis` and `tax_rate_pct`. The line renders with a strikethrough original + discounted amount so the client sees where it landed.
- **Subtotals recompute naturally** from the adjusted line: `net_subtotal`, `tax_subtotal`, `gross_subtotal` all reflect the reduction. Gratuity (service charge / tip) is computed on the reduced `net_subtotal`, matching current behavior.
- **Totals display**: below the net subtotal add a "Discount (net)" row showing `original_line_net − adjusted_line_net` (i.e. the net-equivalent of the gross discount for that line's VAT rate). Grand total no longer has a separate discount line — the reduction is already inside the subtotals.
- **Deal builder UI (`deals_.$id.tsx`)**: when "Apply discount" is toggled on, show a target dropdown listing currently selected space/package/extra lines with their gross amounts, plus the gross discount amount input. Cap the amount at the target line's gross.
- **Client proposal view (`p.$token.tsx`)**: same rendering — line shows discounted amount, totals block shows the net discount row. No new client interaction.

Back-compat: old proposals with `discount` but no `discount_target` fall back to today's behavior (flat deduction from gross_subtotal) so existing saved proposals still render.

### 2. Menu selection also usable in the deal view

Currently menu-selection groups on F&B packages (`selection_groups`, `selection_mode`, `selection_total_max`) only render in the client proposal (`p.$token.tsx`). Bring the same picker into the manager's deal view with a per-package toggle for who chooses.

- **Per package in deal view**: for every selected F&B package that has selection groups defined, render a "Menu selection" block next to its guests/hours controls containing:
  - A small toggle: **"Selected by" [Manager | Client]** (default: Client, matching today's flow).
  - When **Manager**: render the same checkbox groups (respecting `max_select` per group and `selection_total_max` overall) that the client sees in `p.$token.tsx`. Persist the manager's picks.
  - When **Client**: no picker in the deal view; the client sees it in the proposal as today. Show a small "Client will select" hint.
- **Persistence**: add to `proposal.offer`:
  - `menu_selection_mode_by_pkg: { [packageId]: "manager" | "client" }`
  - `menu_choices_by_pkg: { [packageId]: { [groupLabel]: string[] } }` (manager's picks, when mode is manager)
- **Client proposal view**: for packages where mode is `manager`, hide the picker and instead render the manager-chosen items as a read-only list under the package. Packages in `client` mode keep today's interactive picker.
- **Reuse**: extract the current checkbox-group UI in `p.$token.tsx` into a shared `MenuSelectionPicker` component in `src/components/menu-selection-picker.tsx` and use it from both the deal view and the proposal.

Validation stays identical to today's client-side rules: enforce each group's `max_select` and the overall `selection_total_max`.

## Out of scope

- No changes to how `selection_groups` are authored in the catalog.
- No changes to gratuity math, min-revenue logic, or existing stage/calendar behavior.
- No new database columns — both changes fit inside the existing `proposals.offer` JSON.

## Technical notes

- `src/lib/pricing.ts`: extend `Offer` with `discount_target?: { kind, id }`; in `computeTotals`, after building `lines`, locate the target line by matching a stable key (add `sourceKind` + `sourceId` to `LineItem`) and adjust that line's amounts. Fallback path: no target → today's flat gross deduction.
- `Totals` gains `discount_net`; rendering sites (`deals_.$id.tsx` quote card + `p.$token.tsx` totals) show a "Discount (net)" row and drop the old separate gross discount row when a target is set.
- `MenuSelectionPicker` receives `pkg`, `value`, `onChange`, `readOnly` — the read-only mode is used to render the manager's picks on the client proposal.
