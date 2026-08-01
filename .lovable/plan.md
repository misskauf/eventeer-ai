## Event Brief per deal

An internal, editable operations brief attached to each deal — auto-drafted from data you already captured (proposal, catalog, contacts) and completed by the team.

### 1. Migration — `event_briefs`

Columns: `id`, `company_id`, `deal_id` (unique), `body` (HTML text), `generated_at`, `updated_at`, `created_by`, `created_at`.
- Grants for `authenticated` + `service_role`, RLS on, policies scoped with the existing `is_member_of(auth.uid(), company_id)` pattern (no anon access — briefs are internal only).
- `updated_at` trigger reusing `set_updated_at()`.

### 2. Brief generation (`src/lib/event-brief.ts`)

Reuses the contract's `ContractContext` / `buildPlaceholderValues` so names, dates, packages, extras and staff read exactly as they do on the contract. Produces HTML with these sections:

- **Event overview** — client name + company, event type, date, guest count, deal stage/status.
- **Contacts** — client email (phone if present), deal owner.
- **Space & timing** — selected space(s), event hours; blank prompt lines for arrival/setup, guest start, end, teardown.
- **Food & beverage** — food package, drinks package, menu selections, allergen/dietary notes pulled from `fb_packages.allergen_notes`, plus a blank line for client-specific dietary requests.
- **Extras & staffing** — selected extras and staff with counts/hours.
- **Team notes / run-of-show** — empty editable section with a short prompt.

Blank fields render as a labelled line so they're obvious in print.

### 3. Server functions (`src/lib/event-brief.functions.ts`)

`getEventBrief(dealId)`, `saveEventBrief(dealId, body)`, `regenerateEventBrief(dealId)` — all behind `requireSupabaseAuth`, gathering the same deal/proposal/catalog rows the contract renderer uses. First open auto-creates the brief if none exists.

### 4. Deal detail UI

- New **Brief** tab alongside the existing tabs on `deals_.$id.tsx` (and `deals-tabs.tsx` where relevant).
- Write / Preview sub-tabs: editing uses the existing `RichTextEditor`, preview uses the shared `ContractDocument` so formatting matches contracts.
- Save button writes to `event_briefs.body`.
- **Regenerate from deal** button with a confirm dialog warning that manual edits will be overwritten.
- **Download PDF** button using the same `window.print()` + `.printable` / `no-print` stylesheet approach as the contract page, with the venue logo and company details in a branded header.

### Technical notes

No new editor, no redesign, no new dependencies. Reuses `contracts.ts` data gathering, `RichTextEditor`, `ContractDocument`, the existing print CSS pattern, and current RLS helpers.
