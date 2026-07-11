## Problem

The client preview page stays on "Loading proposal…" forever. `p.$token.tsx` gates render on `!state || !totals`. `totals` depends on `offer`, which requires `feesCfg` to be non-null:

```ts
const offer = useMemo(() => { if (!feesCfg) return null; ... }, [...])
```

`feesCfg` comes from `supabase.from("fee_config").select("*").eq("company_id", ...).maybeSingle()`. When the row is missing (older companies created before the `create_company_workspace` RPC seeded `fee_config`, or when RLS blocks the anonymous public read on `fee_config`), `fc.data` is `null` and the page hangs.

The public proposal route runs unauthenticated (`ssr:false` + `supabase` anon client). `fee_config` almost certainly has no `TO anon` SELECT policy, so the read silently returns `null` for every visitor even when a row exists — this is the root cause for every viewer, not just old companies.

## Fix

1. Move the `fee_config`, `spaces`, `fb_packages`, `extras`, and `pricing_seasons` reads into the existing `resolveProposalToken` server function (uses `supabaseAdmin`, bypasses RLS). Return them alongside `proposal/company/deal` so the public page never touches those tables directly with the anon client.
2. In `p.$token.tsx`, consume the pre-fetched arrays from `res` instead of calling `supabase.from(...)` client-side. Fall back to `{}` for `feesCfg` when the row is truly missing, so `offer` still builds.
3. Same treatment for the read-only shared dashboard route `d.$token.tsx` if it has the equivalent gap (verify while editing).

No schema changes required. No new RLS policies (keeps `fee_config`/catalog tables non-public — safer than granting `anon`).

## Technical notes

- Extend `resolveProposalToken` return type with `feeConfig`, `spaces`, `packages`, `extras`, `seasonMultiplier`.
- Delete the client-side `Promise.all` catalog fetch in `p.$token.tsx`; hydrate state directly from `res`.
- Keep `submitClientSelection` unchanged.

## Verify

Open a fresh "Preview as client" link → page renders totals, not the loading state.
