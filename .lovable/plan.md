## Goal
One shared renderer for contract HTML so the template editor, the internal deal preview, and the client signing page can never drift apart — and stop leaking the internal template name to the client.

## 1. New shared component
Create `src/components/contract-document.tsx`:

- Props: `{ html: string | null | undefined; className?: string }`.
- Runs `ensureHtml()` (from `@/lib/contracts`) then `DOMPurify.sanitize()` with an explicit allow-list:
  - `ALLOWED_TAGS`: `ul, ol, li, h1, h2, h3, h4, p, hr, table, thead, tbody, tr, td, th, img, a, strong, em, u, br, div, span`
  - `ALLOWED_ATTR`: `style, href, src, alt, target, colspan, rowspan, class`
  - `ADD_ATTR: ['style','target']`
- Renders a single `<div className="contract-html prose prose-sm max-w-none dark:prose-invert ...">` with `dangerouslySetInnerHTML`.
- Keeps the existing `.contract-html` CSS hooks in `src/styles.css` so bullets/headings render even without the typography plugin.

## 2. Tailwind typography plugin
`@tailwindcss/typography` is not currently installed (Tailwind v4 CSS-first config, no plugin registered). Add it so `prose` classes work as first-class styling:

- `bun add -d @tailwindcss/typography`
- In `src/styles.css`, add `@plugin "@tailwindcss/typography";` near the top (after `@import "tailwindcss"`).
- Leave the existing `.contract-html` fallback rules in place as a safety net.

## 3. Replace the three inline renderers
Swap each `<div className="prose ..." dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ensureHtml(...)) }} />` for `<ContractDocument html={...} />`:

- `src/components/contracts-panel.tsx` — the template editor preview / viewer dialog (line ~516). Keep the plain-text sanitize (line ~657) that strips all tags for the card excerpt — unrelated.
- `src/routes/_authenticated/deals_.$id.tsx` — the internal deal-side contract preview (inside `ContractsPanel` usage, only if a second inline renderer exists there; otherwise no change since `ContractsPanel` already owns it).
- `src/routes/c.$token.tsx` — the client signing page body (line ~130).

## 4. Hide the internal template name from the client
In `src/routes/c.$token.tsx`:

- Remove the `<h1>{contract.template_name || "Event contract"}</h1>` header.
- Header block shows only: company logo + company name, and a neutral title — prefer `deal.client_name ? \`Event Agreement — ${deal.client_name}\` : "Event Agreement"`.
- Also update the browser tab: `head: () => ({ meta: [{ title: "Event Agreement" }] })` (no template name).
- The dialog title inside `contracts-panel.tsx` (manager view) keeps `template_name` — that side is internal.

## 5. Manual verification
Use an existing template that contains an H1/H2, a bulleted list, a numbered list, an inserted logo, and the signature table. Open it in:
1. The template editor preview dialog.
2. The internal deal contract preview.
3. `/c/:token` in an incognito tab.

Confirm identical rendering (lists show bullets/numbers, headings sized, logo image visible, signature table intact) and that no template name appears on the client page.

## Out of scope
No visual restyle of contracts, no changes to `renderContract`/placeholder logic, no changes to the manager-side wording.
