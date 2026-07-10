// Shared date formatters that include the weekday.

export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
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
  min_revenue: number;
  basis: "net" | "gross";
};

// Pick the most specific matching rule for a given event date.
// Preference: matches both weekday + month > weekday-only > month-only > global.
export function pickMinRevRule(rules: MinRevRule[], iso: string | null | undefined): MinRevRule | null {
  if (!rules?.length) return null;
  const wd = weekdayOf(iso);
  const mo = monthOf(iso);
  const dayMatches = (r: MinRevRule) => !r.days_of_week?.length || (wd != null && r.days_of_week.includes(wd));
  const monthMatches = (r: MinRevRule) => !r.months?.length || (mo != null && r.months.includes(mo));
  const specificity = (r: MinRevRule) =>
    (r.days_of_week?.length ? 2 : 0) + (r.months?.length ? 1 : 0);
  const eligible = rules.filter((r) => dayMatches(r) && monthMatches(r));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => specificity(b) - specificity(a) || Number(b.min_revenue) - Number(a.min_revenue));
  return eligible[0];
}
