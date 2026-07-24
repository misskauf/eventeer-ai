## Goal
On the deal detail page, nudge the manager to re-engage the client when a sent proposal has gone unanswered for more than N days. One click sends a templated email with the existing proposal link.

## Current state (verified)
- `proposals.sent_at` is set when the manager sends a proposal, and a matching `share_tokens` row (`kind='client_proposal'`) is created — the URL is `/p/{token}`. Tokens don't expire, so reusing them keeps the client's link valid.
- Client reply lands as a `proposal_selections` row with a `client_action` value (confirm/request_changes/decline).
- `deal_activities` already tracks lifecycle events (`proposal_sent`, etc.).
- `src/lib/notifications.server.ts` exposes `notifyDeal()` which inserts a `notifications` row + `deal_activities` row and best-effort sends via Resend. It targets the internal owner, not the external client — so the client email needs a separate Resend call.
- `companies` has no `proposal_reminder_days` yet; deals/companies have no `language` column (Prompt 8 language not in schema), so this plan defaults copy to English and leaves a hook for later.

## Changes

### 1. Schema (migration)
- `ALTER TABLE public.companies ADD COLUMN proposal_reminder_days integer NOT NULL DEFAULT 5 CHECK (proposal_reminder_days BETWEEN 1 AND 60);`
- No new table; reminders are stored as `deal_activities` rows with `kind = 'proposal_reminder_sent'` and `meta = { proposal_id, version, sent_to, share_url }`.

### 2. Settings UI (`src/routes/_authenticated/settings.tsx`)
- Add a numeric input "Remind client after (days)" bound to `companies.proposal_reminder_days`, in the existing Company card. No restyle.

### 3. Server function (`src/lib/proposal-reminders.functions.ts`, new)
- `sendProposalReminder({ dealId })` with `requireSupabaseAuth`:
  1. Load deal (verify caller's company via `is_member_of`), latest proposal with `sent_at`, existing `share_tokens` row for that proposal.
  2. Guard: proposal must be sent, no `proposal_selections` row exists, deal has a `client_email`.
  3. Reuse the existing token to build `${APP_URL}/p/{token}` (no new token, link stays valid).
  4. Send Resend email directly to `deal.client_email` (subject + body templated; English default, placeholder for future language). Reuses the same Resend helper pattern already in `notifications.server.ts` (extract shared `sendResendEmail` into `notifications.server.ts` export).
  5. Insert `deal_activities` row (`kind='proposal_reminder_sent'`, meta as above).
  6. Also call `notifyDeal()` with `kind='proposal_reminder_sent'` so the bell + owner email fire.
- Return `{ ok: true, sentAt }`.

### 4. Deal detail UI (`src/routes/_authenticated/deals_.$id.tsx`)
- After loading proposals + selections, compute:
  - `latestSent` = most recent proposal with `sent_at`
  - `hasClientReply` = any `proposal_selections` row for that proposal
  - `daysSinceSent` = floor((now - sent_at) / 1 day)
  - `lastReminderAt` = max `created_at` from `deal_activities` where `kind='proposal_reminder_sent'`
- If `latestSent && !hasClientReply && daysSinceSent > company.proposal_reminder_days`, render a small banner above the proposal panel (using existing alert-style component; no new styles):
  - Text: "Sent {daysSinceSent} days ago — no reply yet." + if `lastReminderAt`, "Last reminded {relative}."
  - Button: "Send reminder to client" → calls the server fn, toasts, refreshes.
- Button is disabled while sending and for 24h after `lastReminderAt` (soft anti-spam), with tooltip explaining the cooldown.

### 5. In-app bell (optional, included)
- The `notifyDeal()` call in step 3 already produces a bell notification for the owner ("Reminder sent to client · {client_name}"). No separate crossing-threshold job is added — it would need a scheduler; we surface the threshold visually via the banner instead. Called out here so the user knows the threshold-crossing auto-notification is not implemented.

## Assumptions / open items
- Copy is English only until a deal/company `language` column exists (Prompt 8). The template is structured so swapping to a per-language string map is a one-file change.
- 24h client-side cooldown prevents accidental double-clicks; server does not hard-enforce it (kept simple; can add if needed).
- No visual restyle — banner uses the existing muted/warning card pattern already in the deal page.