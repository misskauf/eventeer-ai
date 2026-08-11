# Richer document editing + Word template upload

Two upgrades to the shared document editors used by BEO/event-brief templates, contract templates, invoice templates, and the client-facing proposal detail fields.

## 1. Richer formatting in the rich text editor

New capabilities in the shared editor toolbar:

- **Tables** — insert a table (with header row), add/remove row, add/remove column, delete table. Grouped under one "Table" dropdown to keep the toolbar tidy.
- **Text colour and highlight** — two small colour swatch pickers with a preset palette plus "no colour".
- **Text alignment** — left / center / right / justify buttons.
- **Font size** — a small size dropdown (e.g. 12 / 14 / 16 / 18 / 24 / 32 px, plus Default).
- **Horizontal rule** — already present, kept and grouped with the new controls.

The toolbar stays two-tier: the `basic` mode (used for shorter client-facing detail fields) gets alignment, colour, highlight, font size and horizontal rule; tables are included in both modes since venues use them in briefs and in descriptions.

Editing surface gets table styling (visible cell borders, resize handles, selected-cell highlight) so tables are usable while editing.

## 2. Rendering and sanitisation

The shared `ContractDocument` renderer already allows table tags and `style`. It will be extended so the new formatting survives sanitisation and printing:

- Keep/confirm `table`, `thead`, `tbody`, `tr`, `td`, `th`, `colgroup`, `col`, `figure`, `figcaption`, `mark`, `s`, `sub`, `sup`.
- Keep `style`, add `align`, `colwidth`, `data-*` alignment/colour attributes emitted by the editor.
- Add print/preview CSS so tables render with borders and correct widths, colours and alignment carry into the PDF/print view, and images scale to the page width.

## 3. Word (.docx) template upload

The existing import flow is improved rather than replaced, and is available from all three template screens (BEO/event brief, contracts, invoices) — the same upload dialog already backs all of them.

Improvements to the .docx conversion:

- Map Word heading styles to `h1`–`h4`, keep bold/italic/underline, lists (bulleted and numbered, incl. nesting), and tables.
- Keep inline images by converting them to embedded data URLs, with a size cap so an image-heavy document doesn't blow up the stored template; oversized images are dropped with a warning.
- Post-process the converted HTML: strip empty paragraphs, normalise Word's smart quotes and non-breaking spaces, drop stray `class` noise, and keep cell alignment.
- Surface conversion warnings from the converter in a collapsible list instead of a wall of text.

UI note shown on the upload step of the dialog, in a highlighted box:

> Complex shapes, text boxes, and exact page layout may not be preserved — imported content becomes editable text you can adjust.

The wording of the dialog title/description becomes generic ("Upload document") so it reads correctly for briefs and invoices, and the existing placeholder-detection/mapping step stays, using each screen's own placeholder list (contract / brief / invoice) rather than always the contract list.

## Out of scope

Pixel-exact Word or PDF reproduction. Imported documents become clean editable HTML, not a page-layout clone.

## Technical notes

- Add TipTap v3 packages: `@tiptap/extension-table` (table, row, cell, header), `@tiptap/extension-text-style` (text style, colour, font size), `@tiptap/extension-highlight`, `@tiptap/extension-text-align`.
- Files touched: `src/components/rich-text-editor.tsx` (extensions + toolbar), `src/components/contract-document.tsx` (allow-list), `src/styles.css` (editor/print table styles), `src/lib/contract-import.ts` (mammoth style map, image handler, HTML cleanup), `src/components/contract-upload-dialog.tsx` (note, generic copy, per-screen placeholder list), and the three call sites in `contracts-panel.tsx`, `invoice-templates-panel.tsx`, `template-manager.tsx` to pass their placeholder list.
- No database migration — templates are already stored as HTML.
