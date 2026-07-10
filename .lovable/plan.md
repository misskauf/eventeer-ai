Good news: deal creation is actually working — the two deals you made are in the database and you're now on the detail page. The perceived "not created" was a load delay. I'll focus on the real asks: a CRM/table view of deals plus a broader status pipeline.

## 1. Expand the deal stages

Add these stages to the `deal_stage` enum (keeping existing ones for backwards compatibility of already-saved deals):

- `new` (default for new deals — replaces `inquiry` as the default)
- `contacted`
- `meeting_scheduled`
- `proposal_sent` (already exists)
- `signed`
- `waiting_payment`
- `invoice_sent`
- `downpayment_received`
- `paid_in_full`
- `payment_delayed`
- `lost` (already exists — kept as a terminal negative state)

Old values (`inquiry`, `proposal_draft`, `client_selected`, `manager_review`, `accepted`) remain valid so no historical data breaks; the UI maps `inquiry → New` and `accepted → Signed` in the label map.

Change the column default from `inquiry` to `new`, and update `NewDealDialog` so newly-created deals start at `new`.

## 2. Turn `/deals` into a CRM table

Replace the current stacked list on `src/routes/_authenticated/deals.tsx` with a proper data table:

| Column | Notes |
|---|---|
| Client | name + company (small subtitle) |
| Email | plain text |
| Event date | formatted date, sortable |
| Guests | number, right-aligned |
| Est. value | currency, right-aligned |
| Stage | inline `<Select>` dropdown — changing it updates the deal in the DB immediately and logs a `deal_activities` row (`kind: 'stage_changed'`) |
| Updated | relative time |
| — | row click opens `/deals/$id` |

Additions above the table:
- Search input (filters by client name / email / company, client-side)
- Stage filter chips (All + one per stage; counts in badges)
- Keeps the existing "New deal" button in the header

Colour-code stage badges by group so the pipeline is scannable:
- Discovery (new, contacted, meeting_scheduled) → neutral
- Proposal (proposal_sent) → blue
- Closed-won path (signed, waiting_payment, invoice_sent, downpayment_received) → amber
- Paid (paid_in_full) → green
- Attention (payment_delayed) → red
- Lost → muted/strikethrough

## 3. Files touched

- `supabase/migrations/*` — new migration: add enum values, change default, no data backfill needed.
- `src/routes/_authenticated/deals.tsx` — rewrite list as table, add search + filters + inline stage editor.
- `src/routes/_authenticated/deals.$id.tsx` — update `STAGE_LABELS` (shared constant extracted to `src/lib/deal-stages.ts`) and stage badge on the detail page.
- `src/lib/deal-stages.ts` (new) — single source of truth for stage keys, labels, order, and colour tokens; consumed by both routes.

## Out of scope for this turn

Kanban/pipeline view, bulk actions, and automated stage transitions from payment events — say the word and I'll layer them on after this ships.
