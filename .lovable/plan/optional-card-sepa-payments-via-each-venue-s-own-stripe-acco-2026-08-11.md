# Optional card / SEPA payments via each venue's own Stripe account

Per-tenant Stripe: every venue connects **their own** Stripe account and money goes
directly to them. No marketplace, no platform account, no Connect.

## How the keys are handled

A single shared Supabase secret cannot hold one Stripe key per venue, so:

- The **publishable key** (safe to expose) is stored on the company record and may be shown in settings.
- The **secret key** is stored encrypted in a separate table that only server code can read.
  It is encrypted with an app-level encryption key kept as a backend secret
  (`STRIPE_KEY_ENCRYPTION_SECRET`, generated automatically — never entered by hand).
- The secret key is only ever decrypted inside a server function / webhook handler.
  It is never selected into the browser, never returned by any API, never logged.
  Settings shows only a masked preview ("sk_live_••••4821") and a Replace / Remove action.

## Database

New table `company_stripe_credentials` (one row per company):
- `company_id` (unique), `secret_key_encrypted`, `secret_key_last4`, `mode` (test/live),
  `webhook_secret_encrypted`, timestamps.
- No grants to `anon` or `authenticated` — service-role only, so no client can read it.
  Row-level security on, with no client-facing read policy.

On `companies`: `stripe_enabled boolean default false`, `stripe_publishable_key text`.

On `payments`: `stripe_session_id`, `stripe_payment_intent`, `stripe_checkout_url`,
`stripe_url_expires_at` — so a generated link can be reused until it expires.

## Settings (Settings → Invoicing, below the bank details)

A "Card & SEPA payments (Stripe)" card:
- Enable toggle (disabled until keys are saved).
- Publishable key field (`pk_...`) and secret key field (`sk_...`, write-only, masked once saved).
- Both keys validated server-side against Stripe before saving; a bad key is rejected with a clear message.
- The webhook URL to paste into Stripe and a field for the signing secret Stripe gives back.
- Gated by the existing `settings` permission.

## Client payment page (`/pay/:token`)

- If Stripe is **not** enabled → unchanged: schedule + bank transfer details only.
- If enabled → each unpaid item gets a "Pay by card / SEPA" button next to the bank details.
  The button calls a public server function that, using that venue's decrypted secret key,
  creates a Stripe Checkout Session (card + SEPA debit where the account supports it) for
  exactly that payment row's amount, currency and label, then redirects the client to Stripe.
- Bank transfer details stay visible either way — card is an added option, not a replacement.
- Return from Stripe lands back on the same page with a "payment received / processing" note.

## Webhook

New public route `/api/public/webhooks/stripe/$companyId`:
- Verifies the Stripe signature with that company's stored webhook secret before doing anything.
- On `checkout.session.completed` (and the async SEPA `payment_intent.succeeded` /
  `checkout.session.async_payment_succeeded`), it marks the matching payment row
  `status='paid'`, `method='stripe'`, `paid_at=now()`.
- Then it runs **exactly the same roll-up as the manual "Mark paid" path**: deal stage moves to
  `downpayment_received`, or `paid_in_full` when every item is paid; a deal activity is logged and
  the venue gets the in-app + email notification.
- To guarantee "exactly like the manual path", the roll-up logic currently inside
  `markPaymentPaid` is extracted into one shared server-only helper used by both.
- Idempotent: an already-paid row is a no-op, so Stripe retries can't double-fire notifications.

## Deal panel

The payment schedule panel shows the method on paid rows (Bank transfer / Card · SEPA) and,
when Stripe is on, a "Copy card payment link" action per unpaid item.

## Files

- migration: new table, company + payments columns
- `src/lib/stripe-tenant.server.ts` — encrypt/decrypt, per-company Stripe REST calls
- `src/lib/payments.server.ts` — shared mark-paid + stage roll-up + notify helper
- `src/lib/stripe-settings.functions.ts` — save/validate/remove keys, read masked status
- `src/lib/payments.functions.ts` — add public `createPaymentCheckout`, reuse shared helper
- `src/routes/api/public/webhooks/stripe.$companyId.ts` — webhook
- `src/routes/pay.$token.tsx`, `src/components/payment-schedule-panel.tsx`,
  `src/routes/_authenticated/settings.invoicing.tsx` — UI

## Notes

- Stripe is called over its REST API from the server — no Node-only SDK in the edge runtime.
- Each venue's Stripe fees and payouts are entirely theirs; the platform never touches the funds.
- The encryption secret is generated automatically; you will only be asked to paste the
  webhook signing secret that Stripe shows when the endpoint is created.
