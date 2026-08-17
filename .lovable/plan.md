# Follow-ups per document type

Today there is one global "Remind client after (days)" setting, and the only reminder is a manual button on the deal page for proposals. This adds configurable follow-ups per document type, plus automatic sending.

## Scope

Two document types now: **Proposal** and **Contract**. Invoices are skipped until invoicing has a client-facing link (the settings screen will show Invoices as "coming soon", disabled).

## What the venue configures (Settings → Deals & workflow)

For each document type, a compact card with:

- **On / off**
- **Follow-up mode**
  - *Send to client automatically* — the system emails the client the reminder.
  - *Notify me instead* — nobody emails the client; the responsible person is told to reach out.
- **Notification channel** (used for "Notify me", and also as the internal copy for automatic sends): In-app only, Email only, or Both.
- **Send every N days** — independent per document type (e.g. proposal every 4 days, contract every 7).
- **Stop after N reminders** — optional cap (blank = keep going).

The existing global "Remind client after (days)" value is migrated into the proposal setting so nothing changes silently.

## When a follow-up fires

A daily background job runs each morning and, for every workspace with follow-ups enabled:

- **Proposal** — latest proposal is sent, the client has not responded (no selection, no client action), the deal is not archived/lost. Fires when days since the proposal was sent (or since the last reminder) reaches the configured interval.
- **Contract** — contract is sent, not signed, not voided. Same interval logic.

Each fire either:
- emails the client (reusing the existing proposal share link / contract signing link) and logs the activity, or
- creates an in-app notification and/or internal email for the deal owner saying "time to follow up with X about the contract".

Every fire is recorded as a deal activity so the deal timeline shows the follow-up history, and the count is used for the "stop after N" cap.

The manual "Send reminder" button on the deal page stays, and now also respects the configured document type.

## Technical notes

- **Migration**: new table `public.followup_configs` (company_id, doc_type `proposal|contract`, enabled, mode `auto|notify`, channel `in_app|email|both`, interval_days, max_reminders, timestamps) with grants, RLS scoped to company membership (settings-level edit permission to write), updated_at trigger, and a backfill that seeds proposal/contract rows for every existing company from `companies.proposal_reminder_days`.
- **Job entry point**: `src/routes/api/public/hooks/followups.ts` (POST), scheduled with `pg_cron` + `pg_net` once daily. Bounded batch per run, single-flight lease row, idempotent progress via the recorded `*_followup_sent` activity timestamp, and per-run caps so a backlog can never fan out.
- **Server logic**: `src/lib/followups.server.ts` for the scan + send, reusing `sendClientEmailAndNotify` / `notifyDeal` from `notifications.server.ts` and the existing share-token and contract-signing-token lookups.
- **Settings UI**: rewrite the "Client follow-up" block in `src/routes/_authenticated/settings.workflow.tsx` as per-document cards backed by a new `src/lib/followups.functions.ts` (read/save, owner or `settings` edit permission).
- **i18n**: new keys in `src/i18n/en.json` and `de.json`; reminder email copy per document type in both languages.
- `companies.proposal_reminder_days` stays for backwards compatibility but the UI reads the new table.
