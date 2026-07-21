## Align contract template row buttons

In `src/components/contracts-panel.tsx` (`ContractTemplatesEditor`), the action buttons on each template row (Edit, Duplicate, Delete) are inconsistently sized and spaced — Edit and Duplicate use `size="sm"` while Delete uses `size="icon"` (h-8 w-8), and they sit as loose siblings of the title flex container with no gap wrapper.

### Change

Wrap the three action buttons in a single right-aligned flex container with consistent sizing and spacing and align the upload template and create template buttons :

- Group `Edit`, `Duplicate`, and `Delete` in `<div className="flex shrink-0 items-center gap-1">`.
- Use the same size (`size="sm"`, height `h-8`) for all three so they line up on one baseline.
- Convert Edit to an icon+label using the `Pencil` icon (from `lucide-react`) to match Duplicate's icon+label pattern.
- Give the Delete button the same `sm` size (icon + label "Delete" or icon-only but matched height `h-8 w-8`) so its bounding box aligns with the others.
- Keep the destructive color on Delete.

No behavior/logic changes — purely visual alignment inside the templates list row.

### Files

- `src/components/contracts-panel.tsx` — rows around lines 640–684.