import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/analytics-widgets";
import { money } from "@/lib/pricing";
import {
  formatValue,
  measureLabel,
  runQuery,
  type CustomWidget,
  type EngineActivity,
  type EngineDeal,
  type EngineItem,
} from "@/lib/analytics-engine";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(215 90% 60%)",
  "hsl(160 60% 45%)",
  "hsl(38 92% 55%)",
  "hsl(280 60% 60%)",
  "hsl(0 72% 60%)",
  "hsl(190 70% 45%)",
  "hsl(20 85% 58%)",
];

export function CustomWidgetView({
  custom,
  chartType,
  range,
  deals,
  activities,
  items,
  currency,
  ownerLabel,
  stageLabel,
  compact,
}: {
  custom: CustomWidget;
  chartType: string | null;
  range: { from: string; to: string };
  deals: EngineDeal[];
  activities: EngineActivity[];
  items: EngineItem[];
  currency: string;
  ownerLabel?: (id: string) => string;
  stageLabel?: (stage: string) => string;
  compact?: boolean;
}) {
  const result = useMemo(
    () =>
      runQuery({
        widget: custom,
        deals,
        activities,
        items,
        range,
        ownerLabel,
        stageLabel,
      }),
    [custom, deals, activities, items, range.from, range.to],
  );

  const fmt = (n: number) => formatValue(n, result.format, (v) => money(v, currency));
  const type = chartType ?? (custom.dimension === "none" ? "kpi" : "bar");
  const height = compact ? "h-56" : "h-72";

  if (result.error) return <EmptyState label={result.error} />;

  if (type === "kpi" || custom.dimension === "none") {
    return (
      <div className="flex flex-col items-start gap-1 py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {measureLabel(custom.measure)}
        </div>
        <div className="text-4xl font-semibold tabular-nums">{fmt(result.total)}</div>
        {custom.dimension !== "none" && (
          <div className="text-xs text-muted-foreground">
            across {result.rows.length} {result.rows.length === 1 ? "group" : "groups"}
          </div>
        )}
      </div>
    );
  }

  if (result.rows.length === 0) return <EmptyState />;

  if (type === "table") {
    return (
      <div className={compact ? "max-h-56 overflow-auto" : "max-h-96 overflow-auto"}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-1">Group</th>
              <th className="py-1 text-right">Deals</th>
              <th className="py-1 text-right">{measureLabel(custom.measure)}</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.key} className="border-t">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right tabular-nums">{r.count}</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(r.value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="py-1.5">Total</td>
              <td />
              <td className="py-1.5 text-right tabular-nums">{fmt(result.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  const data = result.rows.map((r) => ({ label: r.label, value: r.value }));
  const axisWidth = result.format === "currency" ? 80 : 48;

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        {type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} width={axisWidth} />
            <RTooltip formatter={(v: any) => fmt(Number(v))} />
            <Line
              type="monotone"
              dataKey="value"
              name={measureLabel(custom.measure)}
              stroke={COLORS[0]}
              strokeWidth={2}
              dot
            />
          </LineChart>
        ) : type === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} width={axisWidth} />
            <RTooltip formatter={(v: any) => fmt(Number(v))} />
            <Area
              type="monotone"
              dataKey="value"
              name={measureLabel(custom.measure)}
              stroke={COLORS[0]}
              fill="hsl(var(--primary) / 0.18)"
              strokeWidth={2}
            />
          </AreaChart>
        ) : type === "donut" ? (
          <PieChart>
            <RTooltip formatter={(v: any) => fmt(Number(v))} />
            <Legend />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="45%"
              outerRadius="75%"
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={data.length > 6 ? -20 : 0}
              height={data.length > 6 ? 60 : 30}
              textAnchor={data.length > 6 ? "end" : "middle"}
            />
            <YAxis tick={{ fontSize: 12 }} width={axisWidth} />
            <RTooltip formatter={(v: any) => fmt(Number(v))} />
            <Bar dataKey="value" name={measureLabel(custom.measure)} radius={[4, 4, 0, 0]} maxBarSize={56}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
