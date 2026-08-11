# Payment schedule & tracking

Add a per-deal payment schedule: generate it from the accepted proposal total, track status, remind the client, and expose a public payment page with bank details.

## 1. Database migration

New table `public.payments`:
- `id`, `company_id`, `deal_id`, `label` (Deposit / Balance / Full / Post-event), `amount` numeric, `due_date` date, `status` text default `pending` (pending | sent | paid | overdue), `method` text nullable (bank | stripe | other), `paid_at` timestamptz nullable, `marked_by` uuid nullable, `sort` int, `created_at`, `updated_at` (+ updated_at trigger).
- GRANTs for `authenticated` and `service_role`; RLS on.
- Policies: company members can read where they have at least view on the `payments` module; insert/update/delete require edit level (via the existing `has_permission` helper).

Company bank details (used on payment requests, stored with the other invoicing settings on `companies`):
- `bank_account_name`, `bank_name`, `bank_iban`, `bank_bic`, `payment_reference_note` — all text nullable.

Also:
- Add `payments` to the `share_token_kind` enum for the public payment page.
- Seed `payments` rows into `role_permissions` defaults: owner admin, accounting edit, sales_manager view, event_manager none — and extend `seed_role_permissions` so new companies get it.

## 2. Permissions

- Add `payments` to `MODULES` and `MODULE_LABELS` in `src/lib/permissions.ts` so it appears in the permission matrix.
- Server functions call `requirePermission(..., 'payments', 'view'|'edit')`.
- Deal UI section wrapped so users without view access don't see it.

## 3. Payment terms chooser (deal page)

New `PaymentSchedulePanel` in the deal view (`src/routes/_authenticated/deals_.$id.tsx`) with a terms chooser:
- **Pay in full** — one payment, due on a chosen date or "on signing".
- **Installments** — preset templates ("50% on signing / 50% 14 days before event", "30/70", "3 equal parts") or manual rows (label + amount + due date).
- **Invoice after event** — one payment due X days after `event_date`.

Generating validates that the parts sum to the accepted proposal total (small rounding tolerance) and replaces existing unpaid rows; paid rows are never overwritten.

## 4. Tracking

- Schedule table per deal: label, amount, due date, status badge, method, actions.
- Summary line: paid vs outstanding vs overdue.
- "Mark paid" per row → status `paid`, `paid_at = now()`, `method = 'bank'`, `marked_by = caller`.
- Overdue is derived on read (due date passed and not paid) and persisted when the schedule is loaded.
- Stage roll-forward using existing stages: first paid installment → `downpayment_received`; all paid → `paid_in_full`. Never moves a deal backwards.

## 5. Bank details & invoice reuse

- New Settings > Invoicing fields for account name, bank, IBAN, BIC, reference note.
- Bank block rendered on the public payment page and appended to invoice/payment-request output, reusing the existing invoice template and notes.

## 6. Reminders & notifications

Reusing `src/lib/notifications.server.ts`:
- "Payment due" / "Payment overdue" email to the client in the deal's language, containing the amount, due date, bank details and the payment page link.
- When an item is marked paid: in-app notification + email to the venue via `notifyDeal`, plus a `deal_activities` entry.

## 7. Public client payment page

- New route `src/routes/pay.$token.tsx` (`ssr: false`), mirroring the contract/proposal token routes.
- Server functions in `src/lib/payments.functions.ts`: `resolvePaymentToken` (public, admin client inside the handler, validates token kind/expiry) and the authenticated CRUD/generate/mark-paid/remind functions.
- Page shows venue branding, the full schedule with amounts, due dates and statuses, the paid/outstanding summary, and bank transfer details with the payment reference.

## Technical notes

- New files: `src/lib/payments.ts` (shared types, presets, schedule math), `src/lib/payments.functions.ts`, `src/components/payment-schedule-panel.tsx`, `src/routes/pay.$token.tsx`.
- Touched: deal detail route, `settings.invoicing.tsx`, `permissions.ts`, generated Supabase types.
- No payment provider integration — statuses are marked manually; `method` leaves room for Stripe later.
