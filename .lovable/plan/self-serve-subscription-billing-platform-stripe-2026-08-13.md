# Self-serve subscription billing (platform Stripe)

This is *your* billing — venues paying you — and is kept completely separate from the
existing per-venue Stripe (venues collecting money from their clients). Different keys,
different tables, different webhook endpoint.

## What you need before it works

1. A Stripe account for EventFlow/Eventeer.
2. Your monthly subscription Price created in Stripe (e.g. "Standard — €X/month").
3. Stripe Tax switched on in your Stripe dashboard (VAT for DE/EU handled automatically,
   with reverse-charge for valid EU VAT IDs collected at checkout).
4. Two backend secrets I'll ask for: `PLATFORM_STRIPE_SECRET_KEY` and
   `PLATFORM_STRIPE_WEBHOOK_SECRET`. The publishable key stays client-side and is not
   needed for hosted Checkout.

Cards are only ever entered on Stripe's hosted pages. Nothing card-related is stored here.

## Database

On `companies` (all nullable, admin/server-written only):
- `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`,
  `stripe_price_id` (custom price assigned to this venue, falls back to the default),
  `stripe_coupon_id` (optional per-venue discount).
- `subscription_status` keeps its existing values: `trialing`, `active`, `past_due`,
  `expired`, `comped`.

New table `platform_prices` — the price list you can pick from in /admin:
- `stripe_price_id`, `label`, `amount_cents`, `currency`, `interval`, `active`.
- Owner-visible only via server functions; no client grants.

`past_due` is added to the paywall logic: it shows a warning banner and keeps access for a
short grace window, then locks like `expired`.

## Trial → paid

The in-app 30-day trial is unchanged: no card at signup. From day 25 the trial banner adds
a "Add payment method" button; when the trial ends the paywall becomes
"Add a payment method to continue" instead of "contact us".

The button calls a server function that:
- creates (or reuses) a Stripe Customer for the company, stores `stripe_customer_id`,
- creates a Checkout Session in `subscription` mode with the company's assigned price or
  the default price, `automatic_tax: enabled`, `tax_id_collection: enabled`,
  `allow_promotion_codes: true` (so a venue can type a promo code), plus any coupon
  pre-assigned in /admin,
- redirects the owner to Stripe.

Only owners can start checkout. Return lands back in the app with a "activating…" note that
polls until the webhook has landed.

## Manage subscription

Settings → Company gains a "Subscription" card: current status, plan, renewal date, and a
"Manage billing" button that creates a Stripe Billing Portal session — card updates,
invoices/receipts, cancellation, all on Stripe.

## Webhook

New public route `/api/public/webhooks/stripe/platform` (kept distinct from the existing
per-venue endpoint). Signature verified with `PLATFORM_STRIPE_WEBHOOK_SECRET` before
anything is read, using the same verification helper already in the codebase.

| Event | Result |
|---|---|
| `checkout.session.completed` | `active`, store subscription id + `current_period_end` |
| `invoice.paid` | `active`, roll `current_period_end` forward |
| `invoice.payment_failed` | `past_due` |
| `customer.subscription.deleted` | `expired` |

Company is matched by `metadata.company_id` on the session/subscription, with
`stripe_customer_id` as fallback. Idempotent — repeated deliveries are no-ops. Every change
is written to `platform_audit` so /admin shows the history.

## /admin console

Per company row, a new Billing section:
- current Stripe status, plan label, renewal date, customer/subscription id (linked to Stripe),
- "Assign price" — pick from `platform_prices` so a venue can pay a non-standard amount,
- "Assign coupon" — paste a Stripe coupon/promotion code id for a permanent discount,
- both are applied to the next Checkout session and shown in the table.

Existing manual actions (activate, comp, extend trial, lock) stay and continue to work for
accounts that are not paying through Stripe.

## Files

- migration: company columns + `platform_prices`
- `src/lib/platform-stripe.server.ts` — platform Stripe REST calls (no SDK, edge-safe)
- `src/lib/billing.functions.ts` — start checkout, open portal, read subscription state
- `src/routes/api/public/webhooks/stripe.platform.ts` — webhook
- `src/lib/billing.ts`, `src/lib/use-subscription.ts`, `src/components/paywall-gate.tsx`
- `src/components/subscription-card.tsx` + `settings.company.tsx`
- `src/lib/platform.functions.ts`, `src/components/platform-company-table.tsx`

## Notes

- Stripe Tax handles the VAT calculation and Stripe's invoices are the VAT documents;
  filing/OSS remains your accountant's job.
- Nothing is deployed or published as part of this.
