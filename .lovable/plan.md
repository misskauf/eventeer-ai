## Goal
Two connected changes:
1. When the client confirms their selection on the public proposal, notify the event manager by email AND flip the deal to a new "Client approved" stage.
2. In the deal view, add a "Create contract" action that lets the manager pick from pre-uploaded contract templates and generates a filled contract with event details substituted for placeholders.

## Part 1 — Client approval

**New deal stage**: add `client_approved` to `src/lib/deal-stages.ts` between `proposal_sent` and `signed`, with green tone in both table + calendar palettes. Treated as a soft-committed stage (still pre-signature).

**On client submit** (`src/lib/public-share.functions.ts`, `submitClientSelection`):
- After saving `proposal_selections`, set `deals.stage = 'client_approved'` (only if current stage is `proposal_sent` or earlier — don't downgrade a signed deal).
- Insert a `deal_activities` row: "Client confirmed selection".
- Send email to the deal owner. This needs email infrastructure.

**Email**: uses Lovable's managed email API + a scaffolded transactional template `client-selection-confirmed`. Requires the email domain to be set up first — I'll trigger the setup dialog if it isn't. Template shows client name, event date, chosen spaces/packages, total, and a link to `/deals/:id`.

## Part 2 — Contract templates

**Storage + data model**:
- New Storage bucket `contract-templates` (private) for uploaded `.docx` / `.md` / `.txt` files. Managers upload templates from a new Settings → Contracts tab.
- New table `public.contract_templates` (per company): `name`, `body` (text — the template body with `{{placeholders}}`), `file_url` (optional reference to original upload), `is_default`.
- New table `public.contracts` (per deal): `deal_id`, `template_id`, `rendered_body`, `status` (`draft` / `sent` / `signed`), `pdf_url` (nullable, future).

**Template placeholders** — a fixed set the manager can drop into a template:
```
{{client_name}} {{client_company}} {{client_email}}
{{event_date}} {{guest_count}} {{event_hours}}
{{venue}}            — selected space names
{{food_package}}     — selected food package + menu selections
{{drinks_package}}   — selected beverage package
{{extras}}           — bulleted list
{{subtotal}} {{tax}} {{total}} {{currency}}
{{company_name}} {{today}}
```
Substitution happens server-side via a `renderContract(template, deal)` helper that pulls the same computed totals used by the deal builder, so the numbers always match the proposal.

**Deal view UI** (`src/routes/_authenticated/deals_.$id.tsx`):
- New "Create contract" button in the sticky action card (visible from `client_approved` onward — the point where a contract makes sense).
- Opens a dialog: dropdown of available templates + preview of the rendered contract (markdown-rendered). Buttons: "Save as draft" and "Save & mark signed".
- Saved contracts listed below the action card with re-open / regenerate / download options.

**Settings → Contracts tab**: upload a file OR paste template text, name it, mark one as default. Uses `contract_templates` table + storage bucket.

## Out of scope (for now)
- Actual e-signature integration (DocuSign etc.) — the "signed" state is a manual toggle.
- PDF export — contracts render as markdown/HTML for now; can add PDF later.
- Rich template editor — plain textarea with placeholder autocomplete, no WYSIWYG.
- Sending the contract to the client through the portal — this plan only creates it inside the deal.

## Migrations
1. `contract_templates` table + RLS scoped to `is_member_of(auth.uid(), company_id)` + grants.
2. `contracts` table + RLS via deal → company membership + grants.
3. Storage bucket `contract-templates` (private) with policies for members.
4. No schema change needed for the new deal stage — `stage` is free text; adding it to the enum in `deal-stages.ts` is enough.

## Files touched
- `src/lib/deal-stages.ts` — add `client_approved`.
- `src/lib/public-share.functions.ts` — stage transition + activity + email.
- `src/lib/email-templates/client-selection-confirmed.tsx` — new template (after scaffold).
- `src/routes/_authenticated/settings.tsx` — new Contracts card (upload + list templates).
- `src/routes/_authenticated/deals_.$id.tsx` — "Create contract" button + dialog + contracts list.
- `src/lib/contracts.ts` — `renderContract` helper (placeholder substitution).
- New: `src/components/contract-dialog.tsx`, `src/components/contract-template-editor.tsx`.

## One decision I need from you
For the email to the event manager: do you want it to go to (a) the specific user who created the deal, or (b) every owner/admin of the company workspace? I'll default to (a) unless you say otherwise.
