## Goal

Every proposal gets a human-readable quote number (e.g. `BB-2026-0042`) the first time it is sent, with `-v2`, `-v3` … on later re-sent revisions of the same deal.

## 1. Migration

**`companies` — new columns**
- `quote_format text not null default '{venue}-{YYYY}-{seq}'`
- `venue_code text` (nullable, e.g. `BB`)
- `quote_next_seq int not null default 1`
- `quote_seq_padding int not null default 4`
- `quote_reset_yearly boolean not null default true`
- `quote_seq_year int` (year the counter belongs to)

**`proposals`**
- `quote_number text` nullable
- Unique index on `(company_id, quote_number)` where not null.

**`next_quote_number(_company_id uuid) returns text`**
SECURITY DEFINER, `search_path = public`.
- Requires `public.has_permission(_company_id, 'proposals', 'edit')` — otherwise raises.
- `SELECT ... FOR UPDATE` on the company row (atomic under concurrency).
- If `quote_reset_yearly` and `quote_seq_year` is null or ≠ current year → set seq to 1 and `quote_seq_year` to current year.
- Formats `quote_format`, replacing `{venue}` (venue_code, empty string when null), `{YYYY}`, `{YY}`, `{MM}`, `{seq}` (`lpad` to `quote_seq_padding`). Collapses any duplicated `--` left by an empty venue code.
- Increments `quote_next_seq`, returns the string.

Grant execute to `authenticated`.

## 2. Assignment on send

In `saveProposal(send)` in `src/routes/_authenticated/deals_.$id.tsx` (the existing insert path), when `send` is true:
- Look up the most recent prior proposal for this deal that has a `quote_number`.
- **No prior number** → `supabase.rpc('next_quote_number', { _company_id })`, store as-is (first version, no suffix).
- **Prior number exists** → strip any `-vN`, and store `<base>-v<N+1>` (first re-send gives `-v2`). The counter is not advanced.
- Drafts never get a number; the number is written on the proposal row in the same insert (RPC first, then insert).

## 3. Settings UI — Numbering

New "Quote numbering" card in `src/routes/_authenticated/settings.invoicing.tsx` (Invoicing page), visible only with **admin on the `settings` module** (`can('settings','admin')`); read-only otherwise.

Fields: format string (with a token legend), venue code, padding, yearly reset toggle. Live preview computed client-side with the same token rules using the current `quote_next_seq`, e.g. `Next: BB-2026-0042`. Save via the existing `companies` update pattern.

## 4. Display

- **Internal deal view** (`deals_.$id.tsx`): show the current proposal's quote number as a small mono badge next to the proposal version/status.
- **Client page** (`src/routes/p.$token.tsx`): show it in the header near the cover title — `resolveProposalToken` already returns the full proposal row, so no server change is needed beyond the field existing.
- **PDF**: the client page prints via the existing print stylesheet, so the header badge is included automatically; it is styled to stay visible in print.

## Notes

- Contracts and invoices are untouched.
- Existing sent proposals keep `quote_number = null`; the UI simply omits the badge for them.
