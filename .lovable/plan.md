# Enforce the venue minimum before a client can confirm

## Client page (`src/routes/p.$token.tsx`)

- Derive `belowMinimum = totals.min_shortfall > 0`.
- The primary action button is disabled only when the pending action is Confirm and the selection is below the minimum. Request changes and Decline stay fully usable — when one of those is the pending action, the button stays enabled.
- Under the button, when Confirm is blocked, show a short message in the proposal language:
  - EN: "Please add €X more to reach the €Y minimum before you can confirm."
  - DE: "Bitte fügen Sie noch €X hinzu, um das Minimum von €Y zu erreichen."
  X = shortfall, Y = required minimum, both formatted with the proposal currency.
- The existing yellow shortfall note stays as-is; the new message sits next to the button so the reason for the disabled state is obvious.
- As the client changes their selection the totals recompute, so Confirm re-enables automatically the moment the minimum is met.

## Server (`src/lib/public-share.functions.ts`)

- In `submitClientSelection`, after loading the proposal, read `offer.min_revenue_required`.
- If `action === "confirmed"` and the submitted `computed_total`'s net subtotal is below that minimum, reject with an error before writing anything (no selection row, no stage change, no notification).
- Recompute is not available server-side, so the check compares the required minimum against the submitted total; a low value is rejected either way, which is what prevents bypassing the UI.
- `changes_requested` and `declined` are unaffected and always accepted.

## Technical notes

- Minimum lives in the proposal offer JSON as `min_revenue_required` (already used by `computeTotals` to produce `min_shortfall`).
- Two new i18n strings for the blocked-confirm message (EN/DE) alongside the existing `min_shortfall` key.
- Preview tokens keep their no-op behaviour but the button state matches the real client experience.
