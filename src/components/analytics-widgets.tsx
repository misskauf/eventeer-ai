import { useState } from "react";
import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Range = { from: string; to: string };

export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function periodRange(period: string, from: string, to: string): Range {
  const now = new Date();
  const y = now.getFullYear();
  if (period === "month")
    return { from: iso(new Date(y, now.getMonth(), 1)), to: iso(new Date(y, now.getMonth() + 1, 0)) };
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: iso(new Date(y, q * 3, 1)), to: iso(new Date(y, q * 3 + 3, 0)) };
  }
  if (period === "year") return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
  return { from, to };
}

/** Previous period of the same length, immediately before `range`. */
export function previousRange(range: Range): Range {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const len = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const prevTo = new Date(from.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (len - 1) * 86_400_000);
  return { from: iso(prevFrom), to: iso(prevTo) };
}

/** Per-widget date-range override that falls back to the global period. */
export function useWidgetRange(global: Range) {
  const [mode, setMode] = useState("global");
  const [from, setFrom] = useState(global.from);
  const [to, setTo] = useState(global.to);

  const range: Range = mode === "global" ? global : periodRange(mode, from, to);

  const control = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={mode} onValueChange={setMode}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="global">Global period</SelectItem>
          <SelectItem value="month">This month</SelectItem>
          <SelectItem value="quarter">This quarter</SelectItem>
          <SelectItem value="year">This year</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      {mode === "custom" && (
        <>
          <Input
            type="date"
            className="h-8 w-[140px] text-xs"
            value={from}
            aria-label="From"
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            type="date"
            className="h-8 w-[140px] text-xs"
            value={to}
            aria-label="To"
            onChange={(e) => setTo(e.target.value)}
          />
        </>
      )}
    </div>
  );

  return { range, control };
}

export function ChartTypeToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-md border p-0.5">
      {options.map((o) => (
        <Button
          key={o.value}
          size="sm"
          variant={value === o.value ? "secondary" : "ghost"}
          className="h-7 px-2 text-xs"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function WidgetHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function EmptyState({ label = "No data for this period." }: { label?: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  series,
  delta,
  invert,
}: {
  label: string;
  value: string;
  hint?: string;
  series?: { x: string; y: number }[];
  delta?: number | null;
  invert?: boolean;
}) {
  const good = delta == null ? null : invert ? delta < 0 : delta > 0;
  const Icon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          {series && series.length > 1 && (
            <div className="h-10 w-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <Area
                    type="monotone"
                    dataKey="y"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.15)"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        {delta != null && (
          <div
            className={`mt-2 flex items-center gap-1 text-xs ${
              good == null || delta === 0
                ? "text-muted-foreground"
                : good
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {Math.abs(delta).toFixed(0)}% vs. previous period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Tiny line sparkline used where an area feels too heavy. */
export function Sparkline({ data }: { data: { x: string; y: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="y"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
