## Contract templates panel — layout polish

Scope: `src/components/contracts-panel.tsx` (templates section around lines 618–690). No logic changes.

### 1. Fit action buttons in the frame

The **Upload document** and **New template** buttons currently sit side-by-side on the right of the header row, which overflows the narrow Settings frame.

- Change the header row so the button group wraps under the description text on narrow widths and stacks the two buttons vertically.
- Make both buttons full-width within their container so they line up one above the other with equal width.
- Keep the existing icons and labels.

### 2. Clearer template name on each saved template

Each saved template row currently shows the name inline next to badges, with a small sanitized body preview underneath. Make the name easier to scan:

- Promote the template name to its own line above the row content as a bold header (e.g. `text-sm font-semibold`), with the `default` badge next to it.
- Keep the sanitized text preview below the name as secondary muted text.
- Keep Edit / Duplicate / Delete grouped and right-aligned, moving them to their own row underneath on narrow widths so the name is never truncated.

No changes to data model, saving, dialogs, or the rich-text editor.
