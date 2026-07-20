## Goal
Turn contracts into a real signing flow with clear statuses and audit fields, plus a client-facing signing page reached via email.

## Statuses
Extend the `contracts.status` values to a strict set: `draft` → `sent` → `signed` (plus a soft `voided`). Add signer fields to `contracts`:
- `sent_at`, `sent_to_email`
- `signing_token` (unique, opaque) + `signing_token_expires_at`
- `signed_at`, `signed_by_name`, `signed_by_email`, `signed_ip`, `signature_data` (typed name; PNG data URL kept optional for a future drawn signature)
- `voided_at`, `voided_by`
- `created_by` already exists — keep as "prepared by".

Existing `draft`/`signed` rows are preserved; `sent` is new.

## Deal view (manager)
Replace the current "Save draft / Save & mark signed" pair on the contract dialog with the real lifecycle:
- **Save draft** — unchanged.
- **Send to client** (from a draft) — generates the signing token, sets `sent_at`, sends the email, moves status to `sent`. A "Copy signing link" button is shown as a fallback.
- **Mark signed manually** — for offline signatures; records manager as signer, `signed_at = now()`, no IP.
- **Void** — soft-cancels a sent/signed contract (keeps the row for history).

The contracts list on the deal view shows the status badge plus who signed and when (`Signed by <name> · <relative time>`), and offers Resend, Copy link, View, Void, Delete appropriate to the current status.

## Client signing page
New public route `src/routes/c.$token.tsx` (mirrors `p.$token.tsx`):
- Server fn `getContractByToken(token)` — returns the rendered contract body + company name + deal summary; 404 if token unknown, expired, or contract not in `sent`.
- Renders the contract body (monospaced), a typed-name field, an "I agree to the terms above" checkbox, and a **Sign contract** button.
- Server fn `signContract({ token, typed_name })` — validates state is `sent`, stamps `signed_at`, `signed_by_name`, `signed_by_email` (from `sent_to_email`), `signed_ip` (from request header), `signature_data` (the typed name), flips status to `signed`, logs a `deal_activities` row ("Contract signed by <name>"), and clears the token so the link can't be reused.
- After signing, shows a confirmation view with the signed contract and timestamp.

Both server fns are unauthenticated (public), read/write through `supabaseAdmin` scoped by the signing token — same pattern already used by `public-share.functions.ts`.

## Email
Requires setting up a sender domain first (none configured). The plan triggers the email setup dialog before scaffolding. Once set up:
- Scaffold the transactional template system.
- New template `contract-ready-to-sign` with: company name, client name, event date, "Review and sign" button linking to `${origin}/c/${signing_token}`, plain-text fallback.
- Sending happens inside the "Send to client" server fn; if the send fails, the status still moves to `sent` and the manager can use "Copy signing link" / "Resend".

## Files touched
- Migration: add columns to `contracts`, add `sent`/`voided` to the allowed status set (currently free text — enforce with a CHECK), add unique index on `signing_token`.
- `src/components/contracts-panel.tsx` — new action buttons, status badges, signer metadata, resend/copy/void handlers.
- `src/routes/c.$token.tsx` (new) — client signing page.
- `src/lib/contracts.functions.ts` (new) — `getContractByToken`, `signContract`, `sendContractToClient`, `voidContract` server functions.
- `src/lib/email-templates/contract-ready-to-sign.tsx` (new) — after email scaffold runs.
- `src/routes/_authenticated/deals_.$id.tsx` — no structural change; picks up the richer panel.

## Out of scope
- Drawn/uploaded signature image (typed name + checkbox is the signature for now; column is there for a later upgrade).
- Countersignature by the manager, multi-signer flows, sequential signing.
- PDF export of the signed contract.
- Automatic reminders / expiring links beyond the stored `signing_token_expires_at`.
- Legal e-sign compliance certification (ESIGN/eIDAS) — this is a lightweight audit trail, not a certified e-signature service.

## One prerequisite before I start building
Setting up your sender domain, so the "Send to client" email can go out from your brand.

<presentation-actions>
<presentation-open-email-setup>Set up email domain</presentation-open-email-setup>
</presentation-actions>
