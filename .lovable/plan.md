## Notification layer

Adds an in-app + email notification system scoped per company, reusing the existing `company_id` + RLS pattern.

### 1. Database (single migration)

New table `public.notifications`:
- `id uuid pk`
- `company_id uuid → companies(id) on delete cascade`
- `deal_id uuid → deals(id) on delete cascade` (nullable)
- `recipient_user_id uuid → auth.users(id)` (nullable = whole company / deal owner)
- `kind text` (`lead_created`, `client_confirmed`, `client_requested_changes`, `client_declined`, `contract_signed`, extensible)
- `title text`, `body text`
- `read_at timestamptz` (nullable)
- `created_at timestamptz default now()`
- Index on `(company_id, created_at desc)` and `(recipient_user_id, read_at)`

GRANTs to `authenticated` + `service_role`, RLS enabled. Policies:
- **SELECT**: `is_member_of(auth.uid(), company_id)` AND (`recipient_user_id IS NULL OR recipient_user_id = auth.uid()`)
- **UPDATE** (for marking read): same predicate, `WITH CHECK` identical — user can only flip their own or company-wide rows
- **INSERT/DELETE**: service_role only (helper uses admin client)

### 2. Server helper `notifyDeal`

New file `src/lib/notifications.server.ts` (server-only, imported dynamically from `.functions.ts` handlers):

```ts
notifyDeal({ companyId, dealId, kind, title, body, recipientUserId? })
```

Does three things via `supabaseAdmin`:
1. Insert `notifications` row (recipient defaults to deal's `owner_id` when omitted).
2. Insert `deal_activities` row (`kind`, `title` in payload) so the existing activity feed keeps working.
3. Fire email via Resend to (a) the deal owner's auth email and (b) `companies.contact_email` if set — deduped. Uses `from: notifications@<verified domain>` with a plain HTML body derived from `title`/`body` + link back to `/deals/:id`.

Failure of email step is caught and logged; DB inserts still succeed. Idempotency not enforced at DB level (kept simple; callers pass distinct events).

### 3. Wire existing events

Add `notifyDeal` calls at these existing insertion points (no behavior change beyond notification):
- `src/routes/_authenticated/deals.index.tsx` — new lead created → `lead_created`
- `src/lib/public-share.functions.ts` — client submit selection → `client_confirmed` / `client_requested_changes` / `client_declined` based on status
- `src/lib/contracts.functions.ts` — `signContract` → `contract_signed`

Each site already inserts a `deal_activities` row; that inline insert is replaced by the helper to avoid duplication.

### 4. Resend secret + env

Ask user to add `RESEND_API_KEY` via `add_secret` (server-only). Helper reads `process.env.RESEND_API_KEY` and `process.env.RESEND_FROM_EMAIL` (also a secret). If either is missing, helper skips email silently and logs a warning — in-app notification still works.

Never referenced from client code.

### 5. Server functions for the bell

New `src/lib/notifications.functions.ts` (uses `requireSupabaseAuth`, RLS scopes automatically):
- `listMyNotifications({ limit=20 })` → recent rows for current user (own + company-wide)
- `markNotificationsRead({ ids })` → sets `read_at = now()` where null
- `getUnreadCount()` → count of unread

### 6. Bell in `src/components/app-shell.tsx`

Add a top bar to the existing shell (the shell currently has no top bar — sidebar only). Minimal change: insert a small `<header>` inside the `md:pl-56` container above the page content, right-aligned, containing:
- `DropdownMenu` (existing `ui/dropdown-menu`) triggered by a `Bell` lucide icon `Button variant="ghost" size="icon"`.
- Unread count shown as a `Badge` (existing `ui/badge`) positioned on the bell.
- Dropdown lists up to 20 recent notifications: title (bold when unread), body (muted, 2-line clamp), relative time. Click:
  1. `markNotificationsRead({ ids: [id] })`
  2. Invalidate queries
  3. `navigate({ to: '/deals/$id', params: { id: deal_id } })` if `deal_id` present
- "Mark all read" footer button.

Uses TanStack Query with `queryClient.setQueryData` for optimistic mark-read. Polls every 60s via `refetchInterval`. No realtime subscription in V1.

No other shell changes.

### Technical notes

- Helper lives in `.server.ts` so it never leaks to client bundles; server-fn handlers import it dynamically.
- Resend called via `fetch('https://api.resend.com/emails', ...)` — no SDK dependency needed.
- Deal owner email resolved via `supabaseAdmin.auth.admin.getUserById(owner_id)` (already used elsewhere).
- Types regen after migration approval; bell UI wiring comes after that.
