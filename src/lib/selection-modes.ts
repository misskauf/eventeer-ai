/**
 * How the client may interact with each catalog category on a proposal.
 * Stored per deal inside the proposal offer JSON as `category_modes`.
 */

export type CategoryKey = "space" | "food" | "beverage" | "extra" | "staff";

export type CategoryMode = "required_one" | "optional_one" | "multi" | "fixed";

export const CATEGORY_KEYS: CategoryKey[] = ["space", "food", "beverage", "extra", "staff"];

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  space: "Space",
  food: "Food",
  beverage: "Beverages",
  extra: "Extras",
  staff: "Staff",
};

export const CATEGORY_MODE_LABELS: Record<CategoryMode, string> = {
  required_one: "Required — select one",
  optional_one: "Optional — one or none",
  multi: "Multiple",
  fixed: "Fixed — no selection",
};

const NOUNS: Record<CategoryKey, { one: string; many: string }> = {
  space: { one: "space", many: "spaces" },
  food: { one: "food package", many: "food packages" },
  beverage: { one: "beverage package", many: "beverage packages" },
  extra: { one: "extra", many: "extras" },
  staff: { one: "staff role", many: "staff roles" },
};

/** One-line, manager-facing description of what the client will experience. */
export function categoryModeSummary(cat: CategoryKey, mode: CategoryMode): string {
  const n = NOUNS[cat];
  switch (mode) {
    case "required_one":
      return `Client must pick exactly one ${n.one}.`;
    case "optional_one":
      return `Client may pick one ${n.one} or none at all.`;
    case "multi":
      return `Client can tick any number of ${n.many}, including none.`;
    case "fixed":
      return `${n.many[0].toUpperCase()}${n.many.slice(1)} are shown as included — the client can't change them.`;
  }
}

export const DEFAULT_CATEGORY_MODES: Record<CategoryKey, CategoryMode> = {
  space: "required_one",
  food: "required_one",
  beverage: "optional_one",
  extra: "multi",
  staff: "fixed",
};

function isMode(v: unknown): v is CategoryMode {
  return v === "required_one" || v === "optional_one" || v === "multi" || v === "fixed";
}

/**
 * Deal offer override → company default (legacy single/multi columns) →
 * built-in default. Company defaults only exist for space/food/beverage.
 */
export function resolveCategoryModes(
  offer: any,
  company: any,
): Record<CategoryKey, CategoryMode> {
  const stored = (offer?.category_modes ?? {}) as Record<string, unknown>;
  // Legacy per-deal override from the earlier single/multi control.
  const legacy = (offer?.select_mode ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_CATEGORY_MODES };
  for (const cat of CATEGORY_KEYS) {
    const v = stored[cat];
    if (isMode(v)) {
      out[cat] = v;
      continue;
    }
    const legacyVal = legacy[cat];
    if (legacyVal === "multi") {
      out[cat] = "multi";
      continue;
    }
    if (legacyVal === "single") {
      out[cat] = "required_one";
      continue;
    }
    const col = company?.[`client_select_${cat}`];
    if (col === "multi") out[cat] = "multi";
    else if (col === "single") out[cat] = "required_one";
  }
  return out;
}

/** Single-choice modes: exactly one item is charged (or none, for optional_one). */
export function isSingleChoice(mode: CategoryMode): boolean {
  return mode === "required_one" || mode === "optional_one";
}

export const DEFAULT_OFFER_ALTERNATIVES: Record<CategoryKey, boolean> = {
  space: true,
  food: true,
  beverage: true,
  extra: true,
  staff: true,
};

/** Per-category "show alternatives to the client" flags, from the offer JSON. */
export function resolveOfferAlternatives(offer: any): Record<CategoryKey, boolean> {
  const stored = (offer?.offer_alternatives ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_OFFER_ALTERNATIVES };
  for (const cat of CATEGORY_KEYS) {
    if (typeof stored[cat] === "boolean") out[cat] = stored[cat] as boolean;
  }
  return out;
}

/**
 * The manager's proposed pick per category. Falls back to the first selected
 * item when nothing was stored or the stored pick is no longer selected.
 */
export function resolvePrimaryIds(
  offer: any,
  modes: Record<CategoryKey, CategoryMode>,
  idsByCategory: Record<CategoryKey, string[]>,
): Record<CategoryKey, string> {
  const stored = (offer?.primary_ids ?? {}) as Record<string, unknown>;
  const out = {} as Record<CategoryKey, string>;
  for (const cat of CATEGORY_KEYS) {
    const ids = idsByCategory[cat] ?? [];
    const v = stored[cat];
    if (typeof v === "string" && ids.includes(v)) out[cat] = v;
    else if (isSingleChoice(modes[cat])) out[cat] = ids[0] ?? "";
    else out[cat] = "";
  }
  return out;
}

/** Which of a category's selected items are actually charged. */
export function chargeableIds(
  mode: CategoryMode,
  primaryId: string | undefined,
  selectedIds: string[],
): string[] {
  if (!isSingleChoice(mode)) return selectedIds;
  if (primaryId && selectedIds.includes(primaryId)) return [primaryId];
  if (mode === "required_one") return selectedIds.slice(0, 1);
  return [];
}

/**
 * Fixed display order of the category sections on the client proposal page.
 * Reorder this array to change the order everywhere.
 */
export const CATEGORY_SECTION_ORDER: CategoryKey[] = [
  "space",
  "food",
  "beverage",
  "extra",
  "staff",
];

