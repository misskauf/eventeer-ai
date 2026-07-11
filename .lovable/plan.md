## Problem

In the deal builder, the right-column "Event quote" card uses `sticky top-4`. When the quote grows taller than the viewport, its bottom extends past the visible area, and the "Save draft" / "Send to client" buttons rendered below it in the same column get visually covered / hard to reach — they appear to "scroll under" the totals card.

## Fix

Constrain the sticky quote card so it never exceeds the viewport height, and scroll its own contents internally when needed. This keeps the totals pinned while ensuring the action buttons below always remain visible.

Change in `src/routes/_authenticated/deals_.$id.tsx` (the Event quote `<Card>` at line 1076):

- Add `max-h-[calc(100vh-2rem)] flex flex-col` to the Card.
- Make `<CardContent>` scrollable: add `overflow-y-auto flex-1 min-h-0`.
- Keep `CardHeader` as the non-scrolling pinned title.

No logic, pricing, or data changes. Purely presentation.

## Out of scope

- No changes to totals math, discount logic, or menu selection features.
- No layout restructuring of the right column beyond the quote card.
