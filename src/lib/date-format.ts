// Shared date formatters that include the weekday.

export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function weekdayOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getDay(); // 0 = Sunday
}

export function monthOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getMonth() + 1; // 1..12 (matches pricing_rules.months)
}

export type MinRevRule = {
  id: string;
  notes: string | null;
  days_of_week: number[] | null;
  months: number[] | null;
  space_ids: string[] | null;
  min_revenue: number;
  basis: "net" | "gross";
};

// Pick the most specific matching rule for a given event date + selected spaces.
// Preference: space-scoped > weekday > month > global; ties broken by higher min_revenue.
export function pickMinRevRule(
  rules: MinRevRule[],
  iso: string | null | undefined,
  selectedSpaceIds?: string[],
): MinRevRule | null {
  if (!rules?.length) return null;
  const wd = weekdayOf(iso);
  const mo = monthOf(iso);
  const selected = selectedSpaceIds ?? [];
  const dayMatches = (r: MinRevRule) => !r.days_of_week?.length || (wd != null && r.days_of_week.includes(wd));
  const monthMatches = (r: MinRevRule) => !r.months?.length || (mo != null && r.months.includes(mo));
  const spaceMatches = (r: MinRevRule) =>
    !r.space_ids?.length || r.space_ids.some((id) => selected.includes(id));
  const specificity = (r: MinRevRule) =>
    (r.space_ids?.length ? 4 : 0) + (r.days_of_week?.length ? 2 : 0) + (r.months?.length ? 1 : 0);
  const eligible = rules.filter((r) => dayMatches(r) && monthMatches(r) && spaceMatches(r));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => specificity(b) - specificity(a) || Number(b.min_revenue) - Number(a.min_revenue));
  return eligible[0];
}

