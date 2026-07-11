## Scope

Let managers scope each minimum-revenue rule to specific spaces (one or many). Empty selection = applies to all spaces (current behavior).

## Changes

**Database migration**
- Add `space_ids uuid[]` (nullable, default `'{}'`) to `public.pricing_rules`.

**Catalog › Rules (`src/routes/_authenticated/catalog.rules.tsx`)**
- Load available spaces (id + name) for the current company.
- In `RuleForm`, add a "Applies to spaces" multi-select chip picker (same chip pattern used for days/months). Empty = "All spaces".
- Persist `space_ids` in insert/update payloads.
- In the rule list row, append space names (or "All spaces") to the meta line.
- Extend the `Rule` type with `space_ids: string[] | null`.

**Rule matching (`src/lib/date-format.ts`)**
- Extend `MinRevRule` with `space_ids: string[] | null`.
- Update `pickMinRevRule(rules, iso, selectedSpaceIds?)` to also require that a rule's `space_ids` is empty OR intersects `selectedSpaceIds`. Add space-scope to specificity so a space-scoped rule outranks a global one for the same date.

**Deal builder (`src/routes/_authenticated/deals_.$id.tsx`)**
- Include `space_ids` in the `pricing_rules` select.
- Pass `selectedSpaces` into every `pickMinRevRule(...)` call (initial load, saved-proposal branch, and the `matchedRule` memo — which then needs `selectedSpaces` in its deps).

**Public proposal (`src/routes/p.$token.tsx`)**
- If it calls `pickMinRevRule`, pass the resolved selected space ids too. (Confirm during implementation.)

## Behavior

- Rule with no spaces set → applies to any deal (unchanged).
- Rule with spaces set → only considered when the deal's selected spaces include at least one of them.
- When multiple rules match, prefer the most specific (weekday + month + space scope), then highest `min_revenue` (existing tiebreaker).
