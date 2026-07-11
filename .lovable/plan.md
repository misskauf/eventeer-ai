## Problem

The Event quote card is `sticky top-4` with `max-h-[calc(100vh-2rem)]`, so it occupies nearly the full viewport height. The "Save draft" and "Send to client" buttons are separate siblings that come after the card in normal flow — when you scroll, they slide up *behind* the sticky quote card and stay hidden.

## Fix

Move the action buttons into the sticky Event quote card itself as a pinned footer, so they are always visible alongside the totals regardless of scroll position.

- In `src/routes/_authenticated/deals_.$id.tsx` (~line 1076–1161):
  - Keep the card's header pinned (as today) and the totals area scrollable (`flex-1 min-h-0 overflow-y-auto`).
  - Add a non-scrolling `CardFooter` (or a `div` with `border-t bg-background/95 p-3`) inside the sticky card containing the Save draft and Send to client buttons, stacked full-width.
  - Remove the now-redundant standalone `<div className="flex flex-col gap-2">…buttons…</div>` block that currently lives below the card.

Result: Grand total + primary actions are always visible in the sticky panel; the middle line-items list scrolls internally when the quote is long.
