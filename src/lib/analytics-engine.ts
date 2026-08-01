/**
 * Curated aggregation engine for custom dashboard widgets.
 *
 * Deliberately NOT arbitrary SQL: a fixed set of measures, dimensions and
 * filters computed in memory over data the analytics page already loads.
 */

export type Measure =
  | "leads"
  | "won_deals"
  | "conversion"
  | "revenue"
  | "revenue_net"
  | "revenue_gross"
  | "margin"
  | "margin_pct"
  | "avg_deal_size"
  | "avg_guests"
  | "avg_days_to_win";

export type Dimension =
  | "none"
  | "month"
  | "weekday_request"
  | "weekday_event"
  | "stage"
  | "owner"
  | "event_type"
  | "lead_source"
  | "space"
  | "package"
  | "extra"
  | "staff";

export type ChartType = "bar" | "line" | "area" | "donut" | "kpi" | "table";

export type ValueFormat = "count" | "currency" | "percent" | "days";

export type CustomFilters = {
  stages: string[];
  space_ids: string[];
  owner_ids: string[];
  event_types: string[];
  /** Lead source: "manual" | "lead_form" | … */
  sources?: string[];
  /** F&B package item ids (from deal_items snapshots). */
  package_ids?: string[];
};

export type CustomWidget = {
  id: string;
  title: string;
  measure: Measure;
  dimension: Dimension;
  filters: CustomFilters;
};

export const MEASURES: {
  value: Measure;
  label: string;
  format: ValueFormat;
  requiresCosts?: boolean;
  requiresItems?: boolean;
  /** Cannot be grouped by an item-level dimension. */
  dealOnly?: boolean;
}[] = [
  { value: "leads", label: "Leads (deals created)", format: "count" },
  { value: "won_deals", label: "Won deals", format: "count" },
  { value: "conversion", label: "Conversion rate", format: "percent", dealOnly: true },
  { value: "revenue", label: "Revenue", format: "currency" },
  { value: "revenue_net", label: "Net revenue", format: "currency", requiresItems: true },
  { value: "revenue_gross", label: "Gross revenue", format: "currency", requiresItems: true },
  { value: "margin", label: "Margin", format: "currency", requiresCosts: true, requiresItems: true },
  { value: "margin_pct", label: "Margin %", format: "percent", requiresCosts: true, requiresItems: true },
  { value: "avg_deal_size", label: "Average deal size", format: "currency" },
  { value: "avg_guests", label: "Average guests", format: "count" },
  { value: "avg_days_to_win", label: "Average days to win", format: "days", dealOnly: true },
];

export const DIMENSIONS: { value: Dimension; label: string; itemType?: ItemType }[] = [
  { value: "none", label: "No breakdown (single number)" },
  { value: "month", label: "Month (request date)" },
  { value: "weekday_request", label: "Weekday (request date)" },
  { value: "weekday_event", label: "Weekday (event date)" },
  { value: "stage", label: "Stage" },
  { value: "owner", label: "Owner" },
  { value: "event_type", label: "Event type" },
  { value: "lead_source", label: "Lead source" },
  { value: "space", label: "Space", itemType: "space" },
  { value: "package", label: "Package", itemType: "package" },
  { value: "extra", label: "Extra", itemType: "extra" },
  { value: "staff", label: "Staffing role", itemType: "staff" },
];

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "donut", label: "Donut" },
  { value: "kpi", label: "Single number" },
  { value: "table", label: "Table" },
];

export type ItemType = "space" | "package" | "extra" | "staff";

export const MEASURE_MAP = new Map(MEASURES.map((m) => [m.value, m]));
export const DIMENSION_MAP = new Map(DIMENSIONS.map((d) => [d.value, d]));

export function measureLabel(m: Measure) {
  return MEASURE_MAP.get(m)?.label ?? m;
}
export function dimensionLabel(d: Dimension) {
  return DIMENSION_MAP.get(d)?.label ?? d;
}
export function isItemDimension(d: Dimension) {
  return Boolean(DIMENSION_MAP.get(d)?.itemType);
}
export function measureFormat(m: Measure): ValueFormat {
  return MEASURE_MAP.get(m)?.format ?? "count";
}

/** Single source of truth for which measure/dimension pairs make sense. */
export function incompatibleReason(measure: Measure, dimension: Dimension): string | null {
  const def = MEASURE_MAP.get(measure);
  if (!def) return "Unknown measure";
  if (isItemDimension(dimension) && def.dealOnly)
    return `${def.label} cannot be broken down by individual items.`;
  return null;
}

export function suggestedTitle(measure: Measure, dimension: Dimension) {
  const m = measureLabel(measure);
  if (dimension === "none") return m;
  return `${m} by ${dimensionLabel(dimension).replace(/ \(.*\)$/, "").toLowerCase()}`;
}

/* -------------------------------------------------------------------------- */
/* Input shapes                                                               */
/* -------------------------------------------------------------------------- */

export type EngineDeal = {
  id: string;
  owner_id: string;
  stage: string;
  source: string | null;
  event_type: string | null;
  guest_count: number | null;
  estimated_value: number;
  created_at: string;
  updated_at: string;
  event_date: string | null;
};

export type EngineActivity = { deal_id: string; kind: string; meta: any; created_at: string };

export type EngineItem = {
  deal_id: string;
  item_type: ItemType;
  item_id: string | null;
  item_name: string;
  space_id: string | null;
  line_total: number;
  line_gross?: number | null;
  line_cost: number | null;
};

export type EngineRow = { key: string; label: string; value: number; count: number };

export type EngineResult = {
  rows: EngineRow[];
  total: number;
  format: ValueFormat;
  error?: string;
};

const WON_STAGES = new Set([
  "client_approved",
  "signed",
  "waiting_payment",
  "invoice_sent",
  "downpayment_received",
  "paid_in_full",
  "payment_delayed",
  "accepted",
]);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isWonStage(stage: string) {
  return WON_STAGES.has(stage);
}

function num(v: unknown) {
  return Number(v ?? 0) || 0;
}

function inRange(day: string | null | undefined, from: string, to: string) {
  if (!day) return false;
  const d = day.slice(0, 10);
  return d >= from && d <= to;
}

function daysBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

type Bucket = {
  key: string;
  label: string;
  order: number;
  deals: EngineDeal[];
  revenue: number; // item revenue (net), only used by item dimensions
  gross: number;
  cost: number;
  dealIds: Set<string>;
};

export function runQuery(input: {
  widget: CustomWidget;
  deals: EngineDeal[];
  activities: EngineActivity[];
  items: EngineItem[];
  range: { from: string; to: string };
  ownerLabel?: (id: string) => string;
  stageLabel?: (stage: string) => string;
  spaceLabel?: (id: string) => string;
}): EngineResult {
  const { widget, deals, activities, items, range } = input;
  const { measure, dimension, filters } = widget;
  const format = measureFormat(measure);
  const bad = incompatibleReason(measure, dimension);
  if (bad) return { rows: [], total: 0, format, error: bad };

  const itemDim = DIMENSION_MAP.get(dimension)?.itemType ?? null;
  const needsItems =
    itemDim !== null ||
    measure === "margin" ||
    measure === "margin_pct" ||
    measure === "revenue_net" ||
    measure === "revenue_gross";

  // --- filter deals -------------------------------------------------------
  const spaceFilter = new Set(filters.space_ids ?? []);
  const dealsWithSpace = new Set<string>();
  if (spaceFilter.size) {
    for (const i of items) if (i.space_id && spaceFilter.has(i.space_id)) dealsWithSpace.add(i.deal_id);
  }
  const packageFilter = new Set(filters.package_ids ?? []);
  const dealsWithPackage = new Set<string>();
  if (packageFilter.size) {
    for (const i of items)
      if (i.item_type === "package" && i.item_id && packageFilter.has(i.item_id))
        dealsWithPackage.add(i.deal_id);
  }

  const useEventDate = dimension === "weekday_event";
  const scoped = deals.filter((d) => {
    const day = useEventDate ? d.event_date : d.created_at;
    if (!inRange(day, range.from, range.to)) return false;
    if (filters.stages?.length && !filters.stages.includes(d.stage)) return false;
    if (filters.owner_ids?.length && !filters.owner_ids.includes(d.owner_id)) return false;
    if (filters.event_types?.length && !filters.event_types.includes(d.event_type ?? "")) return false;
    if (filters.sources?.length && !filters.sources.includes(d.source || "manual")) return false;
    if (spaceFilter.size && !dealsWithSpace.has(d.id)) return false;
    if (packageFilter.size && !dealsWithPackage.has(d.id)) return false;
    return true;
  });

  const scopedIds = new Set(scoped.map((d) => d.id));
  const scopedItems = items.filter((i) => scopedIds.has(i.deal_id));

  if (needsItems && scopedItems.length === 0) {
    return {
      rows: [],
      total: 0,
      format,
      error:
        "No item snapshots for this selection yet — run “Rebuild item analytics” on the Item analytics widget.",
    };
  }

  // Per-deal item totals, used by margin/net/gross measures on deal-level dimensions.
  const perDeal = new Map<string, { revenue: number; gross: number; cost: number }>();
  for (const i of scopedItems) {
    const row = perDeal.get(i.deal_id) ?? { revenue: 0, gross: 0, cost: 0 };
    row.revenue += num(i.line_total);
    row.gross += num(i.line_gross ?? i.line_total);
    row.cost += num(i.line_cost);
    perDeal.set(i.deal_id, row);
  }

  // Win timestamps for avg days to win.
  const winAt = new Map<string, string>();
  for (const a of activities) {
    if (a.kind !== "stage_changed" || !scopedIds.has(a.deal_id)) continue;
    if (!WON_STAGES.has(String(a.meta?.to))) continue;
    if (!winAt.has(a.deal_id)) winAt.set(a.deal_id, a.created_at);
  }

  // --- bucket -------------------------------------------------------------
  const buckets = new Map<string, Bucket>();
  const bucket = (key: string, label: string, order: number) => {
    let b = buckets.get(key);
    if (!b) {
      b = { key, label, order, deals: [], revenue: 0, gross: 0, cost: 0, dealIds: new Set() };
      buckets.set(key, b);
    }
    return b;
  };

  if (itemDim) {
    const filteredItems = scopedItems.filter((i) => i.item_type === itemDim);
    const dealById = new Map(scoped.map((d) => [d.id, d]));
    for (const i of filteredItems) {
      if (itemDim === "space" && spaceFilter.size && !(i.space_id && spaceFilter.has(i.space_id))) continue;
      const key = i.item_id ?? i.item_name;
      const b = bucket(key, i.item_name || "—", 0);
      b.revenue += num(i.line_total);
      b.gross += num(i.line_gross ?? i.line_total);
      b.cost += num(i.line_cost);
      if (!b.dealIds.has(i.deal_id)) {
        b.dealIds.add(i.deal_id);
        const d = dealById.get(i.deal_id);
        if (d) b.deals.push(d);
      }
    }
  } else {
    for (const d of scoped) {
      let key = "all";
      let label = "All";
      let order = 0;
      if (dimension === "month") {
        key = d.created_at.slice(0, 7);
        label = key;
      } else if (dimension === "weekday_request") {
        const idx = new Date(d.created_at).getDay();
        key = String(idx);
        label = WEEKDAYS[idx];
        order = idx;
      } else if (dimension === "weekday_event") {
        const idx = new Date(d.event_date!).getDay();
        key = String(idx);
        label = WEEKDAYS[idx];
        order = idx;
      } else if (dimension === "stage") {
        key = d.stage;
        label = input.stageLabel?.(d.stage) ?? d.stage;
      } else if (dimension === "owner") {
        key = d.owner_id;
        label = input.ownerLabel?.(d.owner_id) ?? `${d.owner_id.slice(0, 8)}…`;
      } else if (dimension === "event_type") {
        key = d.event_type || "unspecified";
        label = d.event_type || "Unspecified";
      } else if (dimension === "lead_source") {
        key = d.source || "manual";
        label = d.source || "manual";
      }
      const b = bucket(key, label, order);
      b.deals.push(d);
      b.dealIds.add(d.id);
      const it = perDeal.get(d.id);
      if (it) {
        b.revenue += it.revenue;
        b.cost += it.cost;
      }
    }
  }

  // --- measure ------------------------------------------------------------
  const valueOf = (b: Bucket): number => {
    const won = b.deals.filter((d) => WON_STAGES.has(d.stage));
    switch (measure) {
      case "leads":
        return b.dealIds.size;
      case "won_deals":
        return won.length;
      case "conversion":
        return b.deals.length ? (won.length / b.deals.length) * 100 : 0;
      case "revenue":
        return itemDim
          ? b.revenue
          : won.reduce((s, d) => s + num(d.estimated_value), 0);
      case "margin":
        return b.revenue - b.cost;
      case "margin_pct":
        return b.revenue > 0 ? ((b.revenue - b.cost) / b.revenue) * 100 : 0;
      case "avg_deal_size": {
        if (itemDim) return b.dealIds.size ? b.revenue / b.dealIds.size : 0;
        const total = won.reduce((s, d) => s + num(d.estimated_value), 0);
        return won.length ? total / won.length : 0;
      }
      case "avg_guests": {
        const g = b.deals.map((d) => num(d.guest_count)).filter((n) => n > 0);
        return g.length ? g.reduce((s, n) => s + n, 0) / g.length : 0;
      }
      case "avg_days_to_win": {
        const ds: number[] = [];
        for (const d of won) {
          const at = winAt.get(d.id) ?? d.updated_at;
          const n = daysBetween(d.created_at, at);
          if (n >= 0) ds.push(n);
        }
        return ds.length ? ds.reduce((s, n) => s + n, 0) / ds.length : 0;
      }
      default:
        return 0;
    }
  };

  let rows: EngineRow[] = Array.from(buckets.values())
    .map((b) => ({ key: b.key, label: b.label, value: valueOf(b), count: b.dealIds.size, order: b.order }))
    .filter((r) => dimension === "none" || r.value !== 0 || r.count > 0);

  if (dimension === "month") rows.sort((a, b) => a.key.localeCompare(b.key));
  else if (dimension === "weekday_request" || dimension === "weekday_event")
    rows.sort((a, b) => (a as any).order - (b as any).order);
  else rows.sort((a, b) => b.value - a.value);

  rows = rows.map(({ key, label, value, count }) => ({ key, label, value, count }));

  // Whole-selection total: recompute across everything rather than summing
  // buckets, so averages and rates stay correct.
  const allBucket: Bucket = {
    key: "all",
    label: "All",
    order: 0,
    deals: itemDim ? [] : scoped,
    revenue: 0,
    cost: 0,
    dealIds: new Set(),
  };
  if (itemDim) {
    const dealById = new Map(scoped.map((d) => [d.id, d]));
    for (const i of scopedItems) {
      if (i.item_type !== itemDim) continue;
      allBucket.revenue += num(i.line_total);
      allBucket.cost += num(i.line_cost);
      if (!allBucket.dealIds.has(i.deal_id)) {
        allBucket.dealIds.add(i.deal_id);
        const d = dealById.get(i.deal_id);
        if (d) allBucket.deals.push(d);
      }
    }
  } else {
    for (const d of scoped) {
      allBucket.dealIds.add(d.id);
      const it = perDeal.get(d.id);
      if (it) {
        allBucket.revenue += it.revenue;
        allBucket.cost += it.cost;
      }
    }
  }

  return { rows, total: valueOf(allBucket), format };
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

export function formatValue(
  value: number,
  format: ValueFormat,
  money: (n: number) => string,
): string {
  if (!Number.isFinite(value)) return "—";
  if (format === "currency") return money(value);
  if (format === "percent") return `${value.toFixed(1)}%`;
  if (format === "days") return `${value.toFixed(1)} d`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
