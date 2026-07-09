# Event Proposal Platform — V1 Plan

## Scope for V1
- **In**: multi-tenant company accounts, catalog (spaces, F&B packages, extras, fees), advanced pricing rules, proposal builder, client-editable proposal via magic link, deal dashboard, logo + primary color branding.
- **Deferred to later phases**: contracts + e-signature, payments/reminders, briefing docs for hospitality, upsell follow-ups, stakeholder sharing beyond read-only dashboard link.

## Core Concepts
- **Company** (tenant) → owns users, catalog, branding, deals.
- **User** (event manager / sales manager) → belongs to one company.
- **Client** (lead contact) → identified by email; no login, accesses proposal via signed magic link.
- **Deal** → the full lifecycle record for one event inquiry. Stages: `inquiry → proposal_draft → proposal_sent → client_selected → manager_review → accepted → lost`.
- **Proposal** → versioned snapshot of options offered to the client on a deal.
- **ProposalSelection** → what the client configured/chose.

## Feature Breakdown

### 1. Auth & Company Setup
- Email/password + Google sign-in (Lovable Cloud auth).
- On first signup: user creates a Company (name, logo upload, primary color hex, currency, timezone).
- User roles table (`owner`, `manager`, `sales`) — v1 all can do everything; role scaffolding for later.
- Invite teammates by email (later; v1 = single signup adds users to same company via invite link).

### 2. Catalog (Backend admin UI)
- **Spaces**: name, capacity, base rental fee, photos, description.
- **F&B Packages**: name, per-person price, min guests, category (breakfast/lunch/dinner/cocktail), description, allergen notes.
- **Extras**: name, type (per-person / flat / per-hour), price, category (AV, decor, entertainment, etc.).
- **Fees**: service charge %, tax %, cleaning fee, overtime fee — configurable defaults per company.

### 3. Pricing Rules Engine (Advanced)
- **Seasons**: date ranges with multipliers (peak/off-peak/holiday).
- **Day-of-week rules**: per space, minimum revenue for e.g. Saturday in December.
- **Per-guest thresholds**: e.g. min 50 guests for dinner package X.
- **Minimum rental fee** per space (independent of F&B revenue).
- **Auto-applied charges**: service % and tax % applied automatically on totals.
- **Shortfall detection**: when configured proposal falls below required minimum, engine flags the gap and suggests: (a) add extras to hit minimum, (b) offer manager-approved discount, (c) upgrade package.

### 4. Proposal Builder (Manager)
- Manager creates deal from inquiry (client name, email, event date, guest count, event type, notes).
- Adds space(s), F&B options, extras — pricing rules auto-compute totals with breakdown.
- Defines **client constraints**: which items are swappable, guest count range, which extras are optional vs required, whether discount is applied.
- Preview mode shows exactly what client will see.
- Send → generates signed magic-link URL, emails client with branded template.

### 5. Client Proposal View (Magic link, no login)
- Company-branded page (logo, primary color).
- Event summary, itemized quote with live totals.
- Client can within manager-defined constraints:
  - Swap between allowed F&B packages
  - Adjust guest count (bounded)
  - Toggle optional extras
  - Add manager-suggested upsells
- Live shortfall warning if selection drops below minimum ("Add X to meet venue minimum, or your manager may need to approve").
- Submit selection → deal moves to `client_selected`.

### 6. Manager Review Loop
- Notified when client submits.
- Sees diff vs. original proposal.
- Actions: **Approve** (deal → `accepted`), **Counter** (edit + resend new proposal version), **Reject**.

### 7. Deal Dashboard
- Table view of all deals: client, event date, stage, value, last activity.
- Filters by stage, date, manager.
- Deal detail page: timeline of activities (created, sent, viewed, selected, approved), full proposal history (versions), notes.
- **Read-only shareable dashboard link** for stakeholders (signed URL, no login).

### 8. Branding
- Per company: logo upload, primary color hex.
- Applied to: client proposal page, client emails, shareable dashboard link.

## Technical Details

- **Stack**: TanStack Start (existing), Lovable Cloud (Supabase) for auth/DB/storage, TanStack Query for data.
- **Routing**:
  - Public: `/`, `/auth`, `/p/$token` (client proposal), `/d/$token` (shared dashboard).
  - Authenticated: `/_authenticated/deals`, `/deals/$id`, `/catalog/spaces`, `/catalog/packages`, `/catalog/extras`, `/catalog/rules`, `/settings/company`.
- **Data model** (key tables, all RLS-scoped by `company_id`):
  - `companies`, `user_roles` (with `company_id`), `spaces`, `fb_packages`, `extras`, `fee_config`, `pricing_seasons`, `pricing_rules`
  - `deals`, `proposals` (versioned JSON snapshot of offer + constraints), `proposal_selections`, `deal_activities`
  - `share_tokens` (magic links for client proposal + shared dashboard, with expiry)
- **Pricing engine**: pure TypeScript module in `src/lib/pricing/` — takes catalog + selection + rules → returns line items, subtotals, charges, minimum-check result, suggestions. Used by both manager builder and client view.
- **Emails**: server function using Lovable AI Gateway or Resend for proposal-sent notifications (v1 can be a simple templated email; deferred if out of scope).
- **File storage**: company logos via Supabase Storage.
- **Security**: RLS policies scoped by `company_id`; magic links are signed tokens (HMAC + expiry) that resolve server-side to a specific `proposal_id` without exposing internal IDs.

## What to Build First (implementation order)
1. Cloud enablement + auth + company/user_roles schema.
2. Catalog CRUD (spaces, packages, extras, fees).
3. Pricing rules + engine module (with tests).
4. Deal creation + proposal builder.
5. Magic link + client proposal view + selection submission.
6. Manager review loop + deal dashboard + shared dashboard link.
7. Branding (logo + color) applied across client-facing surfaces.

## Explicitly Out of V1
Contracts, e-signature, Stripe payments, installment reminders, hospitality briefing docs, follow-up upsell workflow, client accounts, custom fonts/cover images.
