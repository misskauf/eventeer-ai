
# Optional Invoicing (Document generation only)

Add an optional "Invoice" step to signed deals. No payment collection, no numbering guarantees, no bank details, no paid tracking. Two modes chosen in Settings:

- **External** — venue invoices in their own tool; EventFlow just marks the stage.
- **EventFlow template** — generate an invoice document from the accepted proposal, rendered via the shared `ContractDocument` component, printable to PDF from the browser.

## Data model (single migration)

- `companies` — add:
  - `invoice_mode text not null default 'external'` — `'external' | 'template'`
  - `invoice_notes text` — optional footer notes (e.g. "Payment due within 14 days")
- `invoice_templates` — new table (mirrors `contract_templates`):
  - `company_id`, `name`, `body_html`, `is_default boolean`, timestamps. RLS + GRANTs per company membership (same pattern as `contract_templates`).
- `invoices` — new table:
  - `company_id`, `deal_id`, `template_id nullable`, `body_html` (rendered snapshot), `mode text` (`'external'|'template'`), `status text` (`'draft'|'sent'|'done'`), `issued_at nullable`, timestamps. RLS + GRANTs by company membership.
- Reuse existing `invoice_sent` value on `deal_stage` enum — no enum change.

## Placeholder system

Extend the existing contract placeholder renderer (`src/lib/contracts.ts`) OR add a sibling `src/lib/invoices.ts` that shares the token map. Placeholders available:

- Client: `{{client_name}}`, `{{client_email}}`, `{{client_company}}`
- Event: `{{event_name}}`, `{{event_date}}`, `{{event_start}}`, `{{event_end}}`, `{{guest_count}}`, `{{venue}}`
- Line items table: `{{line_items_table}}` — HTML table of accepted proposal selections (space, food, beverages incl. extra hours, extras) with qty, unit price, line total.
- Totals: `{{subtotal}}`, `{{service_charge}}`, `{{tax}}`, `{{total}}`, `{{currency}}`
- Meta: `{{today}}`, `{{invoice_notes}}`
- Company: `{{company_name}}`, `{{company_address}}`, `{{company_logo}}`, `{{company_email}}`

Line items and totals derive from the **accepted `proposal_selections`** row via the existing pricing engine — no re-computation logic invented.

## Settings UI (`src/routes/_authenticated/settings.tsx`)

New "Invoicing" card:
- Radio: **External** / **EventFlow template**. Clearly labeled "Optional".
- If template: manage invoice templates (list + New + Duplicate + Upload — reusing `ContractUploadDialog` and `RichTextEditor`), pick a default. Free-text "Invoice notes" field.

## Invoice templates editor

New page or panel `src/components/invoice-templates-panel.tsx`, mirroring `contracts-panel.tsx`: TipTap rich-text editor with the "Insert placeholder" toolbar bound to the invoice placeholder list. Upload flow reuses the existing document import → HTML conversion.

## Deal detail (`src/routes/_authenticated/deals_.$id.tsx`)

Add an **Invoice** section, only shown when `stage ∈ {signed, waiting_payment, invoice_sent, downpayment_received, paid_in_full}`. Clearly labeled "Optional — invoicing".

- **External mode**: single button **Mark invoice sent** → server fn sets `invoices.status='sent'`, moves stage to `invoice_sent`, calls `notifyDeal({kind:'invoice_sent'})`. Second button **Mark done**.
- **Template mode**: template picker (defaults to the company default) → **Generate invoice** renders placeholders into `invoices.body_html` snapshot → preview via `<ContractDocument>` → **Print / Save PDF** (browser print), **Mark invoice sent**, **Mark done**. Regenerate re-snapshots.

No client-facing signing page. No email of the invoice itself in v1 — venue downloads/prints and sends outside the app (matches "no payment collection").

## Print stylesheet

Add a scoped `@media print` block in `src/styles.css` (or a small `print.css` imported by the invoice preview) that:
- Hides app chrome (`.no-print`, sidebar, headers, buttons).
- Sets white background, black text, A4 page size, sensible margins.
- Preserves the `prose` typography used by `ContractDocument`.

The preview page wraps the document in a `.printable` container so `window.print()` yields a clean PDF.

## Server functions (`src/lib/invoices.functions.ts`)

- `listInvoiceTemplates`, `upsertInvoiceTemplate`, `duplicateInvoiceTemplate`, `deleteInvoiceTemplate`
- `generateInvoice({dealId, templateId?})` — renders snapshot, upserts `invoices` row (draft).
- `updateInvoiceStatus({invoiceId, status})` — updates status + deal stage + `notifyDeal`.

All use `requireSupabaseAuth`; RLS scoped by `is_member_of(auth.uid(), company_id)`.

## Notifications

Extend `notifyDeal` kinds with `invoice_sent` (deal activity + email to team using existing Resend flow). Reuse existing pattern; no new infra.

## Out of scope (explicit)

- No Stripe / payment intents / bank details / IBAN fields.
- No sequential invoice numbers (users can type their own in the template if wanted).
- No "paid" tracking beyond the existing stage badges.
- No client portal for invoices.

## Files touched

- New: migration; `src/lib/invoices.functions.ts`; `src/lib/invoices.ts` (placeholder renderer); `src/components/invoice-templates-panel.tsx`; `src/components/invoice-panel.tsx` (deal-detail section).
- Edited: `src/routes/_authenticated/settings.tsx` (Invoicing card); `src/routes/_authenticated/deals_.$id.tsx` (mount InvoicePanel); `src/lib/notifications.server.ts` (new kind); `src/styles.css` (print rules).
