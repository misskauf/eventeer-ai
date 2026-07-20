## Goal
Replace the plain-text contract editor with a proper rich-text editor (headings, bold/italic, lists, sections, logo/image), let the company's logo + contact details flow into the template automatically, and allow duplicating an existing template as a starting point for a variant. Deal placeholders keep working exactly as they do today.

## Rich-text editor
Introduce TipTap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`) and wrap it in a new `src/components/rich-text-editor.tsx`. Toolbar covers what event contracts actually need:

- Paragraph / Heading 1–3
- Bold, italic, underline
- Bulleted and numbered lists
- Horizontal rule (for section dividers)
- Link
- Image (URL — used for the company logo and any inline images)
- "Insert placeholder" dropdown built from `CONTRACT_PLACEHOLDERS` — inserts `{{key}}` at the cursor as plain text so `renderContract` still substitutes it

The template body switches to **HTML** stored in the existing `contract_templates.body` and `contracts.rendered_body` columns. Sanitisation uses the existing `isomorphic-dompurify` dependency; placeholder substitution stays string-based, so `{{event_date}}`, `{{extras}}`, `{{total}}` etc. keep working inside any element.

**Backward compatibility for existing plain-text templates**: on load, if the body doesn't start with an HTML tag, wrap it in `<pre>…</pre>` so it still renders. Managers can then re-edit and switch to formatted content whenever.

## Company logo & details in templates
Add company profile fields so a template can reference them:

- Migration: add `address text`, `contact_email text`, `contact_phone text`, `website text` to `public.companies`.
- **Settings → Brand**: add inputs for those fields alongside the existing logo URL / name / colour / currency.
- New placeholders in `CONTRACT_PLACEHOLDERS` (populated by `buildPlaceholderValues`):
  - `{{company_logo}}` → `<img src="…" alt="{{company_name}}" style="max-height:64px" />` when a logo URL exists, empty string otherwise
  - `{{company_address}}`, `{{company_email}}`, `{{company_phone}}`, `{{company_website}}`
- The toolbar's "Insert placeholder" dropdown groups these under a **Company** section (deal fields stay under **Deal**).
- The default sample template gets a header block using `{{company_logo}}` + company details so new templates ship with a branded header out of the box.

## Duplicate template
In `ContractTemplatesEditor` (Settings → Contract templates), add a **Duplicate** action next to Edit/Delete. It copies the source template's `body` verbatim, names it `"<Original> (copy)"`, sets `is_default: false`, and opens the edit dialog on the new row so the manager can rename and tweak it before saving. Placeholders — including deal fields and the new company fields — carry over unchanged because they live inside `body`.

## Contract creation & signing views
- `ContractsPanel` "Create contract" dialog: swap the plain `<Textarea>` for the rich-text editor. Save behaviour is unchanged (still writes `rendered_body`).
- Manager viewer (`viewer` dialog): render sanitised HTML instead of `<pre>`.
- Client signing page `src/routes/c.$token.tsx`: render the contract body via sanitised HTML in a styled `.prose` container instead of the current `<pre>` block. Signing UX and audit fields are untouched.

## Technical section
- New dependency: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-underline`.
- New file: `src/components/rich-text-editor.tsx` (client-only component; safe under SSR because it's used inside dialogs / `ssr: false` routes).
- Edits: `src/lib/contracts.ts` (add company placeholders + logo `<img>`), `src/components/contracts-panel.tsx` (rich editor in create dialog + template editor + Duplicate action + HTML viewer), `src/routes/c.$token.tsx` (HTML render), `src/routes/_authenticated/settings.tsx` (company profile fields).
- Migration: `alter table public.companies add column address text, add column contact_email text, add column contact_phone text, add column website text`.
- No schema change to `contract_templates` / `contracts`; content stored as HTML strings in the existing text columns.

## Out of scope
- Uploading logo/images to storage (still URL-based, matching today's logo field).
- Signature image / drawn signature (typed name stays as-is).
- Versioning of templates or contracts.
- PDF export.