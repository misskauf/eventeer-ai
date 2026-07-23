## Goal
Replace the single "Confirm my selection" button on the public proposal (`/p/:token`) with three actions — **Confirm**, **Request changes**, **Decline** — each with a distinct persisted status, deal stage, notification, and post-submit confirmation state. Surface the client's choice + note prominently on the venue-side deal detail with a direct link to the appropriate next step (duplicate proposal for changes, existing Create/Send contract for confirmed).

## Database
Single migration:
- `ALTER TYPE deal_stage ADD VALUE IF NOT EXISTS 'changes_requested';`
- `ALTER TABLE proposal_selections ADD COLUMN client_action text;` (nullable; values: `confirmed | changes_requested | declined`)
- Extend `STAGE_LABELS`, `STAGE_ORDER`, `STAGE_TONES` in `src/lib/deal-stages.ts` with `changes_requested` (amber tone, placed between `proposal_sent` and `client_approved`).

`proposals.status` values are already free-form text — no schema change; we start writing `accepted | changes_requested | declined`.

## Server: `submitClientSelection` (`src/lib/public-share.functions.ts`)
- Extend Zod input with `action: z.enum(["confirmed","changes_requested","declined"])` and optional `note: z.string().optional()`.
- Preview tokens: still no-op.
- Persist `client_action` on the `proposal_selections` insert.
- Merge `client_response.action` + `note` into `proposals.constraints.client_response` (alongside existing fields, so the deal detail can render them).
- Update `proposals.status` based on action (`accepted` / `changes_requested` / `declined`).
- Only advance deal stage when it's still in the pre-approval set:
  - `confirmed` → `client_approved`
  - `changes_requested` → `changes_requested`
  - `declined` → `lost` (allow even if past pre-approval, since declining is terminal — but skip when already `signed`/paid).
- Call `notifyDeal` with matching `kind`: `client_confirmed`, `client_requested_changes`, or `client_declined`, and an appropriate title/body including the note excerpt.

`NotifyKind` already includes all three values, and the notifications table already accepts free-form kinds — no notifications schema change.

## Client: `src/routes/p.$token.tsx`
Total card:
- Replace the single button with three buttons stacked:
  1. **Confirm my selection** (primary, branded) — submits directly, requires nothing extra.
  2. **Request changes** (outline) — opens the existing `overallMessage` textarea inline as required, blocks submit until a non-empty note.
  3. **Decline offer** (ghost / destructive-outline) — opens the same textarea as optional reason.
- Track `pendingAction: "confirmed"|"changes_requested"|"declined"|null` so the message box label + submit-button copy adapt (e.g. "Send change request", "Send decline").
- Refactor `onSubmit(action)` to pass the action + note into `submit()`.
- Preview mode: still non-submitting; toast tells the user which action was clicked.
- After success set `submitted` + `submittedAction`; render a confirmation panel in place of the buttons ("Selection confirmed — the event manager has been notified" / "Your change request was sent" / "Your response has been recorded"), and disable all action buttons.

No restyling beyond adding the two new buttons and the confirmation panel — reuse existing `Button`, `Textarea`, `Card` primitives.

## Client: venue deal detail (`src/routes/_authenticated/deals_.$id.tsx`)
The existing "Client response" card already renders overall message + picks. Enhance it:
- Read `action` from `constraints.client_response` and show a prominent status header inside the card (Confirmed / Changes requested / Declined) with a matching tone (emerald / amber / red).
- Under the header, show a "Next step" action row:
  - `changes_requested` → button **Duplicate & edit proposal** — reuse existing `saveProposal` flow by calling it with a fresh version (call the existing internal handler used by "Save new version"; wire the button to the same code path already used to create a new proposal version and scroll to the proposal editor).
  - `confirmed` → button **Create contract** that scrolls to / opens the existing `ContractsPanel` (already on the page). No new contract code.
  - `declined` → no next-step CTA, just the status.
- Card border/background tone follows the action (keep current emerald default when confirmed).

No changes to the contracts flow, notification pipeline, approval workflow, or pricing engine.

## Files touched
- `supabase` migration (enum + column)
- `src/lib/deal-stages.ts`
- `src/lib/public-share.functions.ts`
- `src/routes/p.$token.tsx`
- `src/routes/_authenticated/deals_.$id.tsx`
