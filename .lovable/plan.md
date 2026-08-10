# Propose one, offer alternatives

Replace "everything selected is summed" with a proposed-pick model per category. The manager picks one recommended item per single-choice category; everything else selected in that category becomes an alternative that is shown but never charged.

## Data stored in the proposal offer JSON

No migration. Three keys in `offer`:

- `category_modes` — already exists: `required_one | optional_one | multi | fixed` per category (space, food, beverage, extra, staff).
- `primary_ids` — new: `{ space?: string, food?: string, beverage?: string }` (and extra/staff if their mode is single-choice), the proposed pick per category.
- `offer_alternatives` — new: `{ space: boolean, food: boolean, beverage: boolean, extra: boolean, staff: boolean }`, default true.

Defaults unchanged: Space & Food = Required-one, Beverages = Optional-one, Extras = Multiple, Staff = Fixed.

## 1. Shared helper (`src/lib/selection-modes.ts`)

- `isSingleChoice(mode)` → true for `required_one` / `optional_one`.
- `DEFAULT_OFFER_ALTERNATIVES` (all true) and `resolveOfferAlternatives(offer)`.
- `resolvePrimaryIds(offer, modes, idsByCategory)`: uses the stored pick when it is still in the category's selected list, otherwise falls back to the first selected item.
- `chargeableIds(mode, primaryId, selectedIds)`: single-choice → `[primary]` (or `[]` for `optional_one` with no pick); `multi`/`fixed` → all selected.

## 2. Proposal builder (`src/routes/_authenticated/deals_.$id.tsx`)

Selection rules panel — each of the five rows gains:
- the existing mode dropdown and one-line summary;
- an "Offer alternatives to client" switch (only meaningful for single-choice modes, disabled otherwise);
- the count of alternatives currently implied, e.g. "1 proposed + 2 alternatives".

Item lists — in a single-choice category, each selected item shows a "Proposed" radio/star control. Exactly one item is marked; the rest are labelled "Alternative". Selecting a different item moves the mark. When a category's mode changes to single-choice and no pick exists, the first selected item becomes the pick automatically; switching to Multiple/Fixed clears the mark.

Event quote total — `resolvedSelection` changes to feed the pricing engine only chargeable ids: `chargeableIds` per category plus each alternative group's default (unchanged behaviour for groups). Alternatives are never in the total. So three beverage packages under Required-one charge only the proposed one.

Below the quote, a small note lists the alternatives being shown but not charged, so the manager can see why the number is lower than the selection.

`buildOfferConfig()` also writes `primary_ids` and `offer_alternatives`.

## 3. Client proposal page (`src/routes/p.$token.tsx`)

Per category section, using the resolved mode:

- Single-choice with alternatives ON — the proposed item renders first in a highlighted card badged "Our recommendation", pre-selected. Alternatives follow as radio rows under a "Or choose an alternative" subheading. `optional_one` also gets the existing "None" row. Switching recomputes the total from the chosen item.
- Single-choice with alternatives OFF — only the proposed item renders (as included/pre-selected); alternatives are not sent to the UI.
- Multiple — checkboxes, all selected items count, unchanged.
- Fixed — display-only "Included" rows, unchanged.

Alternative groups keep their existing pick-one behaviour inside their category section. Section ordering, icons, the sticky totals sidebar, notes, menu selection, and the submit flow are untouched.

## 4. Backwards compatibility

Old proposals without `primary_ids` fall back to the first selected item per single-choice category, and `offer_alternatives` defaults to on — so existing deals render as recommendation + alternatives, and their totals drop to the single charged item (which is the point of this change).

## Technical notes

- Pricing engine (`src/lib/pricing.ts`) is untouched; only the `Selection` passed to it changes.
- No database migration and no changes to fee, tax, or discount logic.
- Settings → Fees keeps seeding default modes as today.
