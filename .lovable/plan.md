## Goal
Make the **Event quote** totals card on the deal page the visual anchor of the right column so managers immediately see the number that matters.

## Proposed changes (visual only, no logic changes)

**1. Card treatment**
- Promote to a "hero" card: subtle gradient background using existing `--primary` token, thicker border, and a stronger shadow so it lifts off the page.
- Add a small currency/receipt icon next to the "Event quote" title and bump the title size.

**2. Hierarchy inside the card**
- Group rows into three tiers with dividers:
  - *Subtotals* (Net subtotal, Total tax, Gross subtotal) — muted, small text.
  - *Adjustments* (Service charge, Discount) — normal text.
  - *Grand total* — large, bold, primary color, in its own highlighted band at the bottom (think invoice-style).
- Right-align all amounts in a monospaced-tabular figure style so digits line up.

**3. Status callouts**
- Turn the "Net minimum not met" line into a proper alert chip (amber background, warning icon) instead of plain red text, so it reads as actionable rather than an error.
- When the minimum IS met, show a subtle green "Minimum met" chip in the same slot.

**4. Sticky behavior (optional)**
- Make the Event quote card `sticky top-4` inside the right column so it stays visible while the manager scrolls through spaces, packages and extras on the left.

## Technical notes
- All styling via existing semantic tokens in `src/styles.css` (`--primary`, `--muted`, `--accent`, `--destructive`) — no hardcoded colors.
- Only the JSX block around line 924 (`<Card>` for totals) in `src/routes/_authenticated/deals_.$id.tsx` changes; totals math stays identical.
- Grand total row uses `text-3xl font-semibold tracking-tight text-primary`.
- Alert chip built from the existing shadcn `Alert` component in `warning` style.

## Out of scope
- No changes to pricing logic, catalog, or proposal flow.
- No changes to other cards on the page.
