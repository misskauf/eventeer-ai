# Event brief: platform brief vs. custom BEO template

Let venues choose between the built-in event brief and their own BEO (Banquet Event Order) template, managed in Settings and rendered with deal placeholders.

## 1. Database migration

- `companies`: add `brief_mode text not null default 'platform'` (allowed: `platform`, `template`).
- New table `event_brief_templates`, mirroring `contract_templates`:
  `id`, `company_id`, `name`, `body` (html), `file_url` (nullable), `is_default` (bool), `created_by`, `created_at`, `updated_at`.
  Same GRANTs, RLS policies (company members, `event_briefs` module permission) and `set_updated_at` trigger as `contract_templates`.
- Regenerate types.

## 2. Placeholders (shared)

Extend `src/lib/contracts.ts` placeholder values with brief-specific tokens so both brief modes resolve the same data:
`{{client_name}}`, `{{client_company}}`, `{{event_date}}`, `{{event_hours}}`, `{{guest_count}}`, `{{space}}`, `{{seating_style}}`, `{{food}}`, `{{beverages}}`, `{{extras}}`, `{{staff}}`, `{{allergens}}`, `{{totals}}`.
Existing contract keys keep working (aliases where names differ, e.g. `venue` → `space`, `food_package` → `food`).
New export `BRIEF_PLACEHOLDERS` (key + label) drives the picker list, plus `renderBrief(body, ctx, extras)` reusing `renderContract`'s token substitution.

## 3. Settings → "Event brief / BEO"

New settings route `/settings/event-brief` (nav entry, module `event_briefs`):
- Toggle: **Use EventFlow brief** vs **Use my own template** → writes `companies.brief_mode`.
- Template manager: a generalised version of the existing `ContractTemplatesEditor` (same list/dialog/rich-text/default/duplicate/delete UX), parameterised by table name and placeholder list, so both contracts and briefs share one component. No new editor.
- Placeholder picker in the edit dialog, listing the brief placeholders (same insertion pattern as the contract editor).
- **Upload document** reuses the existing contract import flow (`contract-import.ts` + `contract-upload-dialog.tsx`) for Word/PDF → HTML, opening the same edit dialog prefilled.
- When template mode is on but no template exists, show an inline warning that the platform brief is used as fallback.

## 4. Brief generation

In `EventBriefPanel` (`src/components/event-brief-panel.tsx`), the generate step becomes:
- Read `companies.brief_mode` and the default `event_brief_templates` row (single extra query alongside the existing company fetch).
- `brief_mode === 'template'` and a default template exists → body = `renderBrief(template.body, ctx, { allergenNotes, seatingStyle, totals })`.
- Otherwise → current `buildBriefHtml` auto layout (unchanged).
- Everything downstream is untouched: editable rich text, save to `event_briefs`, regenerate, `ContractDocument` preview, print-to-PDF, send to event manager.

## Technical notes

- No changes to `event-brief.functions.ts` beyond nothing — sending already takes `body_html` from the panel.
- `contracts-panel.tsx` keeps exporting `ContractTemplatesEditor` as a thin wrapper over the shared editor so contract settings behave exactly as today.
- Seating style comes from the deal's stored `seating_style` (Prompt 25); staff/extras/totals come from the existing offer computation used by `buildPlaceholderValues`.
