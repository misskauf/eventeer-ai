# Rich text for client-facing detail fields

Replace the plain textareas used for client-facing long descriptions and the proposal intro with the existing TipTap editor, and render the saved HTML properly on the client proposal page.

## 1. RichTextEditor gets a simple toolbar mode

`src/components/rich-text-editor.tsx` gains an optional `toolbar?: "full" | "basic"` prop (default `"full"`, so the contract template editor is unchanged).

In `"basic"` mode the toolbar shows only: paragraph, H1/H2/H3, bold, italic, underline, bullet list, numbered list, link. Hidden: insert image, section divider, undo/redo grouping stays, insert logo, insert signature, and the placeholder dropdown. No second component — one conditional inside the existing `Toolbar`.

## 2. New `richtext` field type in CrudList

`src/components/crud-list.tsx`:
- Add `"richtext"` to `Field["type"]`.
- Renders a label plus `<RichTextEditor toolbar="basic" />` with local state and a hidden input carrying the HTML, so the existing FormData submit keeps working.
- On submit, a `richtext` field is stored as a plain string (empty string → `null`). It is not JSON-parsed, so HTML is stored verbatim.

## 3. Catalog editors use it for "Full details"

Switch the `long_description` field (and `long_description_de` where present) from `textarea` to `richtext` in:
- `src/routes/_authenticated/catalog.spaces.tsx`
- `src/routes/_authenticated/catalog.extras.tsx`
- `src/routes/_authenticated/catalog.staff.tsx`
- `src/components/catalog-packages-page.tsx` (food + drinks)

Where a German long description field is missing but the table has the column, it stays as it is today — this prompt only changes the editor widget, not which fields exist.

## 4. Proposal intro in the builder

`src/routes/_authenticated/deals_.$id.tsx`: the intro/cover `Textarea` bound to `introMarkdown` becomes `<RichTextEditor toolbar="basic" value={...} onChange={setIntroMarkdown} />`. It still saves to the same `intro_markdown` key in the offer — no migration.

## 5. Client proposal page renders HTML

`src/routes/p.$token.tsx`: replace every `<Markdown source={...} />` used for the intro and for item `details` / localized long descriptions with `<ContractDocument html={...} />`, keeping the existing `className` spacing.

Legacy plain-text or Markdown-ish values still display: `ensureHtml` (already used by `ContractDocument`) wraps non-HTML text in paragraphs, so old rows render as plain paragraphs rather than raw markup.

## Notes

- No database migration; columns already hold text.
- Contract template editor and the invoice/contract renderers are untouched.
