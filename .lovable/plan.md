## Goal

Let event managers upload an existing contract file (.docx, .pdf, .txt/.md) in Settings → Contract templates, convert it to editable rich text in the existing TipTap editor, and turn any text into `{{placeholder}}` variables — both via auto-detection on upload and via a "Replace selection with placeholder" action.

## Where it lives

Settings → Contract templates → **New template** dropdown gains an **Upload document…** option (next to existing "New / Duplicate"). Upload happens client-side; the resulting HTML is written into the same `contract_templates.body` field the editor already saves. No new tables, no storage bucket — the original file isn't retained.

## Conversion (client-side)

- **.docx** → HTML with [`mammoth`](https://www.npmjs.com/package/mammoth) (`mammoth.convertToHtml`). Preserves headings, bold/italic, lists, tables.
- **.pdf** → text with `pdfjs-dist` (already in the TanStack ecosystem-friendly; pure JS, works in browser). Each page's text lines become `<p>` blocks; blank lines split paragraphs. Formatting is intentionally simplified — users are warned in the upload dialog.
- **.txt / .md** → for `.md`, run through `marked`; for `.txt`, wrap paragraphs in `<p>`.

Max file size 5 MB, enforced client-side with a toast on reject.

## Placeholder replacement

Two mechanisms, both operating on the TipTap editor:

1. **Auto-detect on upload.** After conversion, scan the HTML text for common patterns and open a "Map detected fields" dialog:
   - `[CLIENT NAME]`, `{CLIENT_NAME}`, `<<client name>>`, `___________` labelled lines (e.g. "Name: __________")
   - Fuzzy label match against known placeholders (client name/email, event date, guest count, venue, total, company name/address/etc. from `CONTRACT_PLACEHOLDERS`)
   - Dialog shows each detected token with a dropdown of placeholders + "Skip". Confirmed selections replace all occurrences with `{{key}}` before the body is loaded into the editor.

2. **Manual: select → replace.** New toolbar button in `rich-text-editor.tsx` labelled **Make placeholder** (only enabled when there's a non-empty selection). Opens a small popover listing `CONTRACT_PLACEHOLDERS` grouped Company / Deal (same grouping as the existing Insert placeholder dropdown). Picking one replaces the selected text with `{{key}}`. Works on any text, uploaded or hand-typed.

## UX flow

1. User opens Settings → Contract templates, clicks **Upload document**.
2. File picker (accepts `.docx,.pdf,.txt,.md`). On select, a modal shows: filename, detected format, and a "Convert" button; PDF shows a note that formatting will be simplified.
3. On convert: parse → HTML → auto-detect dialog with mapping table → user confirms.
4. Template editor opens pre-filled with the converted HTML, name defaulted to the filename (without extension). User can further edit, use manual "Make placeholder", then Save — exactly the same save path as today.

## Files touched

- `package.json` — add `mammoth`, `pdfjs-dist`, `marked` (all pure JS, browser-safe).
- `src/lib/contract-import.ts` (new) — `parseDocx(file)`, `parsePdf(file)`, `parseText(file)`, `parseMarkdown(file)`, `detectPlaceholderCandidates(html)`, `applyPlaceholderMap(html, map)`.
- `src/components/contract-upload-dialog.tsx` (new) — file picker + convert + auto-detect mapping UI.
- `src/components/contracts-panel.tsx` and `src/components/contract-templates-editor.tsx` (whichever hosts the templates list in Settings) — wire the "Upload document" action into the template creation flow, opening the new dialog then the existing editor.
- `src/components/rich-text-editor.tsx` — add **Make placeholder** toolbar button + popover; reuses the existing `CONTRACT_PLACEHOLDERS` list.

## Non-goals (this pass)

- Storing the original uploaded file. Only the converted HTML is persisted.
- Preserving PDF layout (columns, images embedded in PDFs). Text-only extraction; users can re-add images via the existing image toolbar.
- Server-side conversion. Everything runs in the browser, so no new server function or bucket is needed.
