/**
 * Registry + config shape for the customizable analytics dashboard.
 * The charts themselves are unchanged — this only describes layout/config.
 */

import {
  CHART_TYPES,
  DIMENSION_MAP,
  MEASURE_MAP,
  isItemDimension,
  suggestedTitle,
  type CustomFilters,
  type CustomWidget,
  type Dimension,
  type Measure,
} from "@/lib/analytics-engine";

export type WidgetSize = "sm" | "md" | "lg";

export type WidgetRangeOverride = { mode: string; from: string; to: string } | null;

export type WidgetConfig = {
  widget_key: string;
  visible: boolean;
  chart_type: string | null;
  size: WidgetSize;
  date_range_override: WidgetRangeOverride;
  /** Per-card filters (built-in cards; custom widgets keep theirs in `custom.filters`). */
  filters?: CustomFilters;
  /** Overlay / compare against the previous equivalent period. */
  compare_previous?: boolean;
  /** Goal card: `null` shows every goal for the current period, otherwise one goal. */
  goal_id?: string | null;
  /** Present only for user-built widgets (`widget_key` = `custom:<id>`). */
  custom?: CustomWidget;
};

export type WidgetDef = {
  key: string;
  label: string;
  /** Empty when the widget has no chart-type choice. */
  chartTypes: { value: string; label: string }[];
  defaultChartType: string | null;
  defaultSize: WidgetSize;
  /** Widget offers its own date-range override control. */
  supportsRange: boolean;
  /** Only shown to users who can view costs/margins. */
  requiresCosts?: boolean;
  /** Set for user-built widgets. */
  custom?: CustomWidget;
};


export const WIDGETS: WidgetDef[] = [
  {
    key: "kpis",
    label: "KPI cards",
    chartTypes: [],
    defaultChartType: null,
    defaultSize: "lg",
    supportsRange: false,
  },
  {
    key: "goals",
    label: "Revenue goals",
    chartTypes: [],
    defaultChartType: null,
    defaultSize: "lg",
    supportsRange: false,
  },
  {
    key: "leads",
    label: "Leads over time",
    chartTypes: [
      { value: "bar", label: "Bar" },
      { value: "line", label: "Line" },
    ],
    defaultChartType: "bar",
    defaultSize: "lg",
    supportsRange: true,
  },
  {
    key: "funnel",
    label: "Sales funnel",
    chartTypes: [],
    defaultChartType: null,
    defaultSize: "md",
    supportsRange: true,
  },
  {
    key: "stage",
    label: "Deal status",
    chartTypes: [
      { value: "donut", label: "Donut" },
      { value: "bar", label: "Bar" },
    ],
    defaultChartType: "donut",
    defaultSize: "md",
    supportsRange: true,
  },
  {
    key: "revenue",
    label: "Revenue over time",
    chartTypes: [
      { value: "area", label: "Area" },
      { value: "line", label: "Line" },
      { value: "bar", label: "Bar" },
    ],
    defaultChartType: "area",
    defaultSize: "lg",
    supportsRange: true,
  },
  {
    key: "weekday",
    label: "By weekday",
    chartTypes: [],
    defaultChartType: null,
    defaultSize: "md",
    supportsRange: true,
  },
  {
    key: "revenue_month",
    label: "Event revenue by month",
    chartTypes: [],
    defaultChartType: null,
    defaultSize: "md",
    supportsRange: false,
  },
  {
    key: "velocity",
    label: "Velocity",
    chartTypes: [],
    defaultChartType: null,
    defaultSize: "lg",
    supportsRange: true,
  },
  {
    key: "reps",
    label: "Sales rep performance",
    chartTypes: [],
    defaultChartType: null,
    defaultSize: "lg",
    supportsRange: true,
  },
  {
    key: "items",
    label: "Item analytics",
    chartTypes: [],
    defaultChartType: null,
    defaultSize: "lg",
    supportsRange: false,
  },
  {
    key: "cost_quality",
    label: "Internal — revenue quality",
    chartTypes: [],
    defaultChartType: null,
    defaultSize: "lg",
    supportsRange: false,
    requiresCosts: true,
  },
];

export const WIDGET_MAP = new Map(WIDGETS.map((w) => [w.key, w]));

export const CUSTOM_PREFIX = "custom:";

export function isCustomKey(key: string) {
  return key.startsWith(CUSTOM_PREFIX);
}

/** Turns a stored custom widget into the same WidgetDef shape the shell renders. */
export function customDef(custom: CustomWidget): WidgetDef {
  const measure = MEASURE_MAP.get(custom.measure);
  return {
    key: `${CUSTOM_PREFIX}${custom.id}`,
    label: custom.title || suggestedTitle(custom.measure, custom.dimension),
    chartTypes: CHART_TYPES.filter(
      (c) => custom.dimension !== "none" || c.value === "kpi" || c.value === "table",
    ).map((c) => ({ value: c.value as string, label: c.label })),
    defaultChartType: custom.dimension === "none" ? "kpi" : "bar",
    defaultSize: custom.dimension === "none" ? "sm" : "md",
    supportsRange: true,
    requiresCosts: measure?.requiresCosts,
    custom,
  };
}

/** Resolves the def for any config entry, built-in or custom. */
export function defFor(entry: WidgetConfig): WidgetDef | undefined {
  if (entry.custom) return customDef(entry.custom);
  return WIDGET_MAP.get(entry.widget_key);
}

export function newCustomWidget(partial?: Partial<CustomWidget>): CustomWidget {
  const measure = (partial?.measure ?? "leads") as Measure;
  const dimension = (partial?.dimension ?? "month") as Dimension;
  return {
    id: partial?.id ?? crypto.randomUUID(),
    title: partial?.title ?? suggestedTitle(measure, dimension),
    measure,
    dimension,
    filters: {
      stages: partial?.filters?.stages ?? [],
      space_ids: partial?.filters?.space_ids ?? [],
      owner_ids: partial?.filters?.owner_ids ?? [],
      event_types: partial?.filters?.event_types ?? [],
      sources: partial?.filters?.sources ?? [],
      package_ids: partial?.filters?.package_ids ?? [],
    },
  };
}

export function emptyFilters(): CustomFilters {
  return { stages: [], space_ids: [], owner_ids: [], event_types: [], sources: [], package_ids: [] };
}

/** True when a card carries at least one active filter. */
export function hasActiveFilters(f?: CustomFilters) {
  if (!f) return false;
  return Object.values(f).some((v) => Array.isArray(v) && v.length > 0);
}

export function defaultEntry(def: WidgetDef): WidgetConfig {
  return {
    widget_key: def.key,
    visible: true,
    chart_type: def.defaultChartType,
    size: def.defaultSize,
    date_range_override: null,
    filters: emptyFilters(),
    compare_previous: false,
    goal_id: null,
    ...(def.custom ? { custom: def.custom } : {}),
  };
}

export function defaultConfig(): WidgetConfig[] {
  return WIDGETS.map(defaultEntry);
}

const SIZES: WidgetSize[] = ["sm", "md", "lg"];

function parseCustom(raw: any): CustomWidget | null {
  if (!raw || typeof raw !== "object") return null;
  const measure = raw.measure;
  const dimension = raw.dimension;
  if (!MEASURE_MAP.has(measure) || !DIMENSION_MAP.has(dimension)) return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  return {
    id: raw.id,
    title: typeof raw.title === "string" && raw.title ? raw.title : suggestedTitle(measure, dimension),
    measure,
    dimension,
    filters: {
      stages: arr(raw.filters?.stages),
      space_ids: arr(raw.filters?.space_ids),
      owner_ids: arr(raw.filters?.owner_ids),
      event_types: arr(raw.filters?.event_types),
      sources: arr(raw.filters?.sources),
      package_ids: arr(raw.filters?.package_ids),
    },
  };
}

function normalizeFilters(raw: any): CustomFilters {
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  return {
    stages: arr(raw?.stages),
    space_ids: arr(raw?.space_ids),
    owner_ids: arr(raw?.owner_ids),
    event_types: arr(raw?.event_types),
    sources: arr(raw?.sources),
    package_ids: arr(raw?.package_ids),
  };
}

/**
 * Drops unknown widget keys, repairs bad values, keeps user-built widgets, and
 * appends any built-in widget that did not exist when the layout was saved.
 */
export function normalizeConfig(raw: unknown): WidgetConfig[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: WidgetConfig[] = [];

  for (const item of list) {
    const key = (item as any)?.widget_key;
    if (typeof key !== "string" || seen.has(key)) continue;

    let def: WidgetDef | undefined;
    let custom: CustomWidget | undefined;
    if (isCustomKey(key)) {
      const parsed = parseCustom((item as any)?.custom);
      if (!parsed || `${CUSTOM_PREFIX}${parsed.id}` !== key) continue;
      custom = parsed;
      def = customDef(parsed);
    } else {
      def = WIDGET_MAP.get(key);
    }
    if (!def) continue;
    seen.add(def.key);

    const chart = (item as any)?.chart_type;
    const size = (item as any)?.size;
    const override = (item as any)?.date_range_override;
    out.push({
      widget_key: def.key,
      visible: (item as any)?.visible !== false,
      chart_type:
        def.chartTypes.length && def.chartTypes.some((c) => c.value === chart)
          ? chart
          : def.defaultChartType,
      size: SIZES.includes(size) ? size : def.defaultSize,
      filters: normalizeFilters((item as any)?.filters),
      compare_previous: (item as any)?.compare_previous === true,
      date_range_override:
        override && typeof override?.mode === "string"
          ? { mode: override.mode, from: String(override.from ?? ""), to: String(override.to ?? "") }
          : null,
      ...(custom ? { custom } : {}),
    });
  }

  for (const def of WIDGETS) if (!seen.has(def.key)) out.push(defaultEntry(def));
  return out;
}

/** Item-level custom widgets need deal_items snapshots to be present. */
export function customNeedsItems(custom: CustomWidget) {
  return isItemDimension(custom.dimension) || Boolean(MEASURE_MAP.get(custom.measure)?.requiresItems);
}


export function sizeClass(size: WidgetSize) {
  if (size === "sm") return "xl:col-span-1";
  if (size === "md") return "xl:col-span-2";
  return "xl:col-span-4";
}
