## Goal
Add an optional "Send for approval" step to the deal flow. Whether approval is required is configured per company in Settings. When required, the deal builder shows a "Send for approval" button instead of "Send to client"; an approver reviews and either approves (unlocking send-to-client) or requests changes.

## Settings
In `src/routes/_authenticated/settings.tsx`, add a new "Deal workflow" card:
- Toggle: **Require internal approval before sending to client** (default off).
- Helper text explaining the flow.

Persisted on `companies` (new column `require_deal_approval boolean default false`).

## Deal states
Add two columns to `public.deals`:
- `approval_status text` — one of `not_required` | `pending` | `approved` | `changes_requested` (default `not_required`).
- `approval_note text` (nullable) — approver's comment when requesting changes.
- `approved_by uuid`, `approved_at timestamptz` (nullable).

When the setting is on, new/edited deals default to `pending` once the manager clicks "Send for approval". When off, deals stay `not_required` and behave exactly as today.

## Deal builder UI (`src/routes/_authenticated/deals_.$id.tsx`)
In the sticky "Event quote" card, replace the current single send action with logic:

- **Approval OFF** → show existing "Send to client" button (no change).
- **Approval ON**:
  - `not_required` / `changes_requested` → **Send for approval** button. Sets `approval_status = pending`. If a note exists from a prior review, show it in an alert above.
  - `pending` → disabled state: "Waiting for approval" + who to ping. Any teammate (with role `owner`/`admin`/`manager` — reuse existing `user_roles`) sees two buttons: **Approve** and **Request changes** (opens a small textarea dialog for the note).
  - `approved` → **Send to client** button enabled + small "Approved by X" badge. Editing key fields (selections, pricing, date) resets status back to `not_required` so it must be re-approved (show a subtle warning).

A small status chip next to the deal title reflects the current approval state.

## Deals list (`src/routes/_authenticated/deals.index.tsx`)
- Add an "Approval" column/chip when the setting is on.
- Add a filter chip: **Awaiting my approval** (shows deals with `approval_status = 'pending'` for approver-role users).

## Permissions
- Any team member of the company can send for approval (existing edit permission).
- Only users with `owner` or `admin` role in `user_roles` can approve / request changes. Enforced via RLS `UPDATE` policy on the approval columns using `has_role`-style check, plus client-side gating of the buttons.

## Files touched
- Migration: `companies.require_deal_approval`; `deals.approval_status/approval_note/approved_by/approved_at`; RLS update policy for approval fields.
- `src/routes/_authenticated/settings.tsx`: new toggle in a "Deal workflow" card.
- `src/routes/_authenticated/deals_.$id.tsx`: approval buttons, status chip, note dialog, edit-resets-approval logic.
- `src/routes/_authenticated/deals.index.tsx`: approval column + "Awaiting my approval" filter.
- `src/lib/deal-stages.ts` (or a new `src/lib/deal-approval.ts`): status labels + tone classes.

## Out of scope
- Email/in-app notifications to the approver (surfaced only via the "Awaiting my approval" filter for now).
- Multi-step / multi-approver chains.
- Approval history log (only the latest note + approver are stored).

## Open questions
1. Which roles should be allowed to approve — just `owner`+`admin`, or also a dedicated `manager` role? (Current schema has `owner` from `create_company_workspace`; confirm what other roles exist.)
2. When an approved deal is edited, should approval auto-reset, or only reset if pricing/selections change (not e.g. renaming the deal)?
