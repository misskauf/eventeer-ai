## Goal

When a lead form submission creates a deal, also create a **draft** proposal with a sensible space + package suggestion, so the manager opens the deal and finds a starting point instead of a blank builder. Nothing is ever auto-sent to the client.

## 1. Migration

- `fb_packages.event_types text[] not null default '{}'`
- `spaces.event_types text[] not null default '{}'` (same semantics, used for a mild tie-break on space choice)

Empty array = "suits any event type". No RLS changes needed (both tables are already company-scoped).

## 2. Catalog editor

In the Food and Beverage package editor (`catalog-packages-page.tsx`, via the shared `crud-list` field set) add a **"Suits event types"** field using the existing `tags` field type — free-text chips, matching the free-text `event_type` on deals (Wedding, Corporate, Birthday, …), with the hint "Leave empty to suit all event types". Show the tags in the list row next to min-guests. Same optional field on spaces.

## 3. Suggestion engine

New server-only helper `src/lib/lead-suggest.server.ts` → `buildSuggestedProposal(companyId, deal)`, using the admin client (the lead-form flow is public/unauthenticated, like the existing deal insert).

Selection rules:
- **Space**: active spaces only; smallest `capacity >= guest_count`; if none is big enough, the largest one; prefer a space whose `event_types` contains the deal's `event_type` (case-insensitive) when there is a tie. Skip if the venue has no spaces.
- **Food package**: active, `min_guests <= guest_count`, and `event_types` empty or containing the event type. Pick the tagged match first, otherwise the untagged candidate that appears most recently in `updated_at`. Skip if no candidate.
- **Beverage package**: same rule, applied to `kind = 'beverage'`.
- Guest count of 0/unknown → skip the min-guests filter rather than suggesting nothing.

Offer JSON is built with exactly the shape the builder writes in `buildOfferConfig()`: `space_ids`, `package_ids`, `extra_ids: []`, `staff_ids: []`, `staff_config: {}`, `package_guests` seeded to `guest_count` for each chosen package, `package_hours: {}`, `season_id: "none"`, `discount: 0`, `discount_target: null`, `min_revenue_required` from the matching pricing rule (same helper logic as the builder), `service_charge_pct_override` from the company's `fee_config` gratuity default, `guest_count`, empty `alternative_groups` / menu maps. So the builder loads it with zero special-casing.

Then, in one transaction-ish sequence:
- insert `proposals` row: `version: 1`, `status: 'draft'`, `sent_at: null`, `constraints: { intro_markdown: "", autodrafted: true }`
- update the deal `stage` to `proposal_draft`
- insert `deal_activities` row `kind: 'lead_autodrafted'` with the chosen space/package ids in `meta`

If neither a space nor any package can be suggested: do nothing at all — the deal stays as created, no proposal row, no stage change. Any failure inside the helper is caught and logged, never surfaced to the public form submitter.

## 4. Hook into the lead form

In `submitLeadForm` (`src/lib/lead-forms.functions.ts`), after the deal insert and its `deal_created` activity, call `buildSuggestedProposal` in a try/catch and pass its result into the notification: when a draft was created, the existing lead email/notification body gains a line "A suggested draft proposal is ready to review." (EN + DE strings alongside the existing lead notification copy).

## 5. Manager review UX

On `deals_.$id.tsx`: when the latest proposal is `status: 'draft'` with `constraints.autodrafted` and no later version exists, render a banner above the builder — **"Suggested draft from lead — review & adjust"**, with a short note that nothing has been sent yet and a button that scrolls to / opens the existing proposal builder with the draft already loaded (the loader already hydrates state from `proposals.offer`, so no new loading path). The banner disappears once the manager saves or sends a new version. No changes to send/approval logic.

## Technical notes

- Reuses the existing offer format and builder state hydration; no new proposal format or components.
- Costs, client-visible payloads, and public server functions are untouched.
- Suggestion runs server-side with admin access only inside the lead-form handler.
