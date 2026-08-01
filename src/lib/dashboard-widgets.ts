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

export function defaultEntry(def: WidgetDef): WidgetConfig {
  return {
    widget_key: def.key,
    visible: true,
    chart_type: def.defaultChartType,
    size: def.defaultSize,
    date_range_override: null,
  };
}

export function defaultConfig(): WidgetConfig[] {
  return WIDGETS.map(defaultEntry);
}

const SIZES: WidgetSize[] = ["sm", "md", "lg"];

/**
 * Drops unknown widget keys, repairs bad values, and appends any widget that
 * did not exist when the layout was saved so new widgets still show up.
 */
export function normalizeConfig(raw: unknown): WidgetConfig[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: WidgetConfig[] = [];

  for (const item of list) {
    const key = (item as any)?.widget_key;
    const def = typeof key === "string" ? WIDGET_MAP.get(key) : undefined;
    if (!def || seen.has(def.key)) continue;
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
      date_range_override:
        override && typeof override?.mode === "string"
          ? { mode: override.mode, from: String(override.from ?? ""), to: String(override.to ?? "") }
          : null,
    });
  }

  for (const def of WIDGETS) if (!seen.has(def.key)) out.push(defaultEntry(def));
  return out;
}

export function sizeClass(size: WidgetSize) {
  if (size === "sm") return "xl:col-span-1";
  if (size === "md") return "xl:col-span-2";
  return "xl:col-span-4";
}
