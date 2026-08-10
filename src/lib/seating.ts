/** Seating styles offered for a space. Shared so proposals and briefs reuse the same list/order. */
export const SEATING_STYLES = [
  "Gala",
  "Banquet",
  "Block",
  "U-Shape",
  "Rows",
  "Standing",
  "Parliamentary",
  "Circle",
  "Restaurant/Bar",
] as const;

export type SeatingStyle = (typeof SEATING_STYLES)[number];

/** Map of seating style → number of guests that fit. A missing style means "not offered". */
export type SeatingCapacities = Record<string, number>;
