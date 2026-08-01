/**
 * Revenue goal tracking: period maths + actual-vs-target progress.
 *
 * Actuals come from signed deals, valued with the accepted proposal's stored
 * line snapshots (deal_items): `line_total` = net, `line_gross` = gross.
 */

export type GoalMetric = "net_revenue" | "gross_revenue";
export type GoalPeriodType = "month" | "quarter" | "year";

export type Goal = {
  id: string;
  company_id: string;
  metric: GoalMetric;
  period_type: GoalPeriodType;
  period_start: string;
  target: number;
  owner_id: string | null;
  space_id: string | null;
};

export type GoalDeal = {
  id: string;
  owner_id: string;
  stage: string;
  event_date: string | null;
  created_at: string;
};

export type GoalItem = {
  deal_id: string;
  space_id: string | null;
  line_total: number;
  line_gross?: number | null;
};

/** Stages that count as signed revenue. */
export const SIGNED_STAGES = new Set([
  "signed",
  "waiting_payment",
  "invoice_sent",
  "downpayment_received",
  "paid_in_full",
  "payment_delayed",
  "accepted",
]);

export const METRIC_LABEL: Record<GoalMetric, string> = {
  net_revenue: "Net revenue",
  gross_revenue: "Gross revenue",
};

export const PERIOD_LABEL: Record<GoalPeriodType, string> = {
  month: "Monthly",
  quarter: "Quarterly",
  year: "Yearly",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Snaps any date to the first day of its period. */
export function normalizePeriodStart(dateStr: string, type: GoalPeriodType) {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (type === "year") return iso(new Date(Date.UTC(y, 0, 1)));
  if (type === "quarter") return iso(new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1)));
  return iso(new Date(Date.UTC(y, m, 1)));
}

export function periodBounds(periodStart: string, type: GoalPeriodType) {
  const start = normalizePeriodStart(periodStart, type);
  const d = new Date(`${start}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const months = type === "year" ? 12 : type === "quarter" ? 3 : 1;
  const end = new Date(Date.UTC(y, m + months, 0));
  return { from: start, to: iso(end) };
}

export function periodLabel(periodStart: string, type: GoalPeriodType) {
  const d = new Date(`${normalizePeriodStart(periodStart, type)}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (type === "year") return String(y);
  if (type === "quarter") return `Q${Math.floor(m / 3) + 1} ${y}`;
  return `${MONTHS[m]} ${y}`;
}

/** The period of `type` that contains today. */
export function currentPeriodStart(type: GoalPeriodType, today = new Date()) {
  return normalizePeriodStart(iso(today), type);
}

export function shiftPeriod(periodStart: string, type: GoalPeriodType, delta: number) {
  const d = new Date(`${normalizePeriodStart(periodStart, type)}T00:00:00Z`);
  const step = type === "year" ? 12 : type === "quarter" ? 3 : 1;
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + step * delta, 1)));
}

export type GoalStatus = "not_started" | "ahead" | "on_track" | "behind" | "done";

export type GoalProgress = {
  actual: number;
  target: number;
  pct: number;
  elapsedPct: number;
  status: GoalStatus;
  dealIds: string[];
  from: string;
  to: string;
};

/** Fraction of the period already elapsed, 0–100. */
function elapsedPercent(from: string, to: string, today = new Date()) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T23:59:59Z`).getTime();
  const now = today.getTime();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return ((now - start) / (end - start)) * 100;
}

/** Revenue date used for a deal: the event date, falling back to creation. */
function revenueDate(d: GoalDeal) {
  return (d.event_date ?? d.created_at).slice(0, 10);
}

export function computeGoalProgress(input: {
  goal: Goal;
  deals: GoalDeal[];
  items: GoalItem[];
  today?: Date;
}): GoalProgress {
  const { goal, deals, items } = input;
  const today = input.today ?? new Date();
  const { from, to } = periodBounds(goal.period_start, goal.period_type);

  const byDeal = new Map<string, { net: number; gross: number; spaces: Set<string> }>();
  for (const i of items) {
    const row = byDeal.get(i.deal_id) ?? { net: 0, gross: 0, spaces: new Set<string>() };
    const net = Number(i.line_total ?? 0) || 0;
    row.net += net;
    row.gross += Number(i.line_gross ?? net) || 0;
    if (i.space_id) row.spaces.add(i.space_id);
    byDeal.set(i.deal_id, row);
  }

  let actual = 0;
  const dealIds: string[] = [];
  for (const d of deals) {
    if (!SIGNED_STAGES.has(d.stage)) continue;
    const day = revenueDate(d);
    if (day < from || day > to) continue;
    if (goal.owner_id && d.owner_id !== goal.owner_id) continue;
    const row = byDeal.get(d.id);
    if (goal.space_id && !row?.spaces.has(goal.space_id)) continue;
    if (!row) continue;
    actual += goal.metric === "gross_revenue" ? row.gross : row.net;
    dealIds.push(d.id);
  }

  const target = Number(goal.target ?? 0) || 0;
  const pct = target > 0 ? (actual / target) * 100 : 0;
  const elapsedPct = elapsedPercent(from, to, today);

  let status: GoalStatus;
  if (elapsedPct <= 0) status = "not_started";
  else if (elapsedPct >= 100) status = pct >= 100 ? "done" : "behind";
  else if (pct >= elapsedPct + 5) status = "ahead";
  else if (pct >= elapsedPct - 5) status = "on_track";
  else status = "behind";

  return { actual, target, pct, elapsedPct, status, dealIds, from, to };
}

export const STATUS_LABEL: Record<GoalStatus, string> = {
  not_started: "Not started",
  ahead: "Ahead",
  on_track: "On track",
  behind: "Behind",
  done: "Achieved",
};
