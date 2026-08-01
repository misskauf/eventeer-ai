import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/pricing";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { stageLabel, STAGE_ORDER } from "@/lib/deal-stages";
import { useCanViewCosts } from "@/lib/cost-visibility";
import { ItemAnalytics } from "@/components/analytics-items";
import { RequirePermission } from "@/components/permission-guard";
import {
  ChartTypeToggle,
  EmptyState,
  KpiCard,
  WidgetHeader,
  iso,
  periodRange,
  previousRange,
  useWidgetRange,
  type Range,
} from "@/components/analytics-widgets";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: () => (
    <RequirePermission module="analytics">
      <AnalyticsPage />
    </RequirePermission>
  ),
  head: () => ({
    meta: [
      { title: "Analytics — Event Pipeline Insights" },
      {
        name: "description",
        content:
          "Track leads, conversion, booked revenue, pipeline value, funnel drop-off and sales velocity for your venue.",
      },
      { property: "og:title", content: "Analytics — Event Pipeline Insights" },
      {
        property: "og:description",
        content:
          "Leads, conversion rate, booked revenue, funnel drop-off and rep performance for your venue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Deal = {
  id: string;
  owner_id: string;
  stage: string;
  source: string | null;
  estimated_value: number;
  created_at: string;
  updated_at: string;
  event_date: string | null;
};

type Activity = { deal_id: string; kind: string; meta: any; created_at: string };
type Proposal = { deal_id: string; created_at: string; sent_at: string | null };

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
const SIGNED_STAGES = [
  "signed",
  "waiting_payment",
  "invoice_sent",
  "downpayment_received",
  "paid_in_full",
  "payment_delayed",
  "accepted",
];
const SENT_STAGES = [
  "proposal_sent",
  "changes_requested",
  "client_selected",
  "manager_review",
  "client_approved",
  ...SIGNED_STAGES,
];
const LOST_STAGES = new Set(["lost"]);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(215 90% 60%)",
  "hsl(160 60% 45%)",
  "hsl(38 92% 55%)",
  "hsl(280 60% 60%)",
  "hsl(0 72% 60%)",
  "hsl(190 70% 45%)",
  "hsl(20 85% 58%)",
];

function monthKey(s: string) {
  return s.slice(0, 7);
}
function daysBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}
function avg(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
function inRange(dateStr: string | null | undefined, r: Range) {
  if (!dateStr) return false;
  const day = dateStr.slice(0, 10);
  return day >= r.from && day <= r.to;
}
function deltaPct(current: number, prev: number): number | null {
  if (!prev) return current ? 100 : null;
  return ((current - prev) / prev) * 100;
}

function computeKpis(list: Deal[], activities: Activity[]) {
  const leads = list.length;
  const won = list.filter((d) => WON_STAGES.has(d.stage));
  const open = list.filter((d) => !WON_STAGES.has(d.stage) && !LOST_STAGES.has(d.stage));
  const bookedRevenue = won.reduce((s, d) => s + Number(d.estimated_value || 0), 0);
  const pipeline = open.reduce((s, d) => s + Number(d.estimated_value || 0), 0);
  const winDays: number[] = [];
  for (const d of won) {
    const winAct = activities.find(
      (a) => a.deal_id === d.id && a.kind === "stage_changed" && WON_STAGES.has(String(a.meta?.to)),
    );
    const days = daysBetween(d.created_at, winAct?.created_at ?? d.updated_at);
    if (days >= 0) winDays.push(days);
  }
  return {
    leads,
    wonCount: won.length,
    lostCount: list.filter((d) => LOST_STAGES.has(d.stage)).length,
    conversion: leads ? (won.length / leads) * 100 : 0,
    bookedRevenue,
    pipeline,
    avgDeal: won.length ? bookedRevenue / won.length : 0,
    avgDaysToWin: avg(winDays),
  };
}

/** Monthly buckets across a range, used for KPI sparklines. */
function monthlySeries(list: Deal[], pick: (bucket: Deal[]) => number) {
  const map = new Map<string, Deal[]>();
  for (const d of list) {
    const k = monthKey(d.created_at);
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ x: k, y: pick(v) }));
}

function AnalyticsPage() {
  const currency = useCompanyCurrency();
  const { canViewCosts } = useCanViewCosts();

  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [members, setMembers] = useState<{ user_id: string; role: string }[]>([]);

  const today = new Date();
  const [period, setPeriod] = useState("year");
  const [customFrom, setCustomFrom] = useState(iso(new Date(today.getFullYear(), 0, 1)));
  const [customTo, setCustomTo] = useState(iso(today));
  const globalRange = periodRange(period, customFrom, customTo);

  // Per-widget range overrides (fall back to the global period)
  const leadsW = useWidgetRange(globalRange);
  const funnelW = useWidgetRange(globalRange);
  const stageW = useWidgetRange(globalRange);
  const revenueW = useWidgetRange(globalRange);
  const weekdayW = useWidgetRange(globalRange);
  const velocityW = useWidgetRange(globalRange);
  const repsW = useWidgetRange(globalRange);

  const [leadsChart, setLeadsChart] = useState<"bar" | "line">("bar");
  const [stageChart, setStageChart] = useState<"donut" | "bar">("donut");
  const [stageMetric, setStageMetric] = useState<"count" | "value">("count");
  const [revenueChart, setRevenueChart] = useState<"area" | "line" | "bar">("area");
  const [revenueMode, setRevenueMode] = useState<"booked" | "pipeline">("booked");
  const [weekdayMetric, setWeekdayMetric] = useState<"requests" | "revenue">("requests");

  useEffect(() => {
    (async () => {
      const [d, a, p, m] = await Promise.all([
        supabase
          .from("deals")
          .select("id, owner_id, stage, source, estimated_value, created_at, updated_at, event_date")
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("deal_activities")
          .select("deal_id, kind, meta, created_at")
          .order("created_at", { ascending: true })
          .limit(20000),
        supabase.from("proposals").select("deal_id, created_at, sent_at").limit(5000),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      setDeals((d.data as Deal[]) ?? []);
      setActivities((a.data as Activity[]) ?? []);
      setProposals((p.data as Proposal[]) ?? []);
      setMembers((m.data as any[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const byCreated = (r: Range) => deals.filter((d) => inRange(d.created_at, r));
  const byEvent = (r: Range) => deals.filter((d) => inRange(d.event_date, r));

  // ---------- KPIs (global period, with previous-period deltas) ----------
  const kpiScoped = useMemo(() => byCreated(globalRange), [deals, globalRange.from, globalRange.to]);
  const kpiPrev = useMemo(
    () => byCreated(previousRange(globalRange)),
    [deals, globalRange.from, globalRange.to],
  );
  const kpis = useMemo(() => computeKpis(kpiScoped, activities), [kpiScoped, activities]);
  const prevKpis = useMemo(() => computeKpis(kpiPrev, activities), [kpiPrev, activities]);

  const spark = useMemo(
    () => ({
      leads: monthlySeries(kpiScoped, (b) => b.length),
      conversion: monthlySeries(kpiScoped, (b) =>
        b.length ? (b.filter((d) => WON_STAGES.has(d.stage)).length / b.length) * 100 : 0,
      ),
      booked: monthlySeries(kpiScoped, (b) =>
        b.filter((d) => WON_STAGES.has(d.stage)).reduce((s, d) => s + Number(d.estimated_value || 0), 0),
      ),
      pipeline: monthlySeries(kpiScoped, (b) =>
        b
          .filter((d) => !WON_STAGES.has(d.stage) && !LOST_STAGES.has(d.stage))
          .reduce((s, d) => s + Number(d.estimated_value || 0), 0),
      ),
      avgDeal: monthlySeries(kpiScoped, (b) => {
        const w = b.filter((d) => WON_STAGES.has(d.stage));
        return w.length ? w.reduce((s, d) => s + Number(d.estimated_value || 0), 0) / w.length : 0;
      }),
      daysToWin: monthlySeries(kpiScoped, (b) => computeKpis(b, activities).avgDaysToWin ?? 0),
    }),
    [kpiScoped, activities],
  );

  // ---------- Leads over time ----------
  const leadsScoped = useMemo(() => byCreated(leadsW.range), [deals, leadsW.range.from, leadsW.range.to]);
  const sources = useMemo(
    () => Array.from(new Set(leadsScoped.map((d) => d.source || "manual"))).slice(0, 6),
    [leadsScoped],
  );
  const leadsOverTime = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of leadsScoped) {
      const k = monthKey(d.created_at);
      const row = map.get(k) ?? { month: k, total: 0 };
      row.total += 1;
      const src = d.source || "manual";
      row[src] = (row[src] ?? 0) + 1;
      map.set(k, row);
    }
    for (const row of map.values()) for (const s of sources) row[s] = row[s] ?? 0;
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [leadsScoped, sources]);

  // ---------- Funnel ----------
  const funnel = useMemo(() => {
    const list = byCreated(funnelW.range);
    const leads = list.length;
    const proposalSent = list.filter(
      (d) => proposals.some((p) => p.deal_id === d.id && p.sent_at) || SENT_STAGES.includes(d.stage),
    ).length;
    const approved = list.filter((d) => WON_STAGES.has(d.stage)).length;
    const signed = list.filter((d) => SIGNED_STAGES.includes(d.stage)).length;
    const steps = [
      { name: "Inquiry", value: leads },
      { name: "Proposal sent", value: proposalSent },
      { name: "Client approved", value: approved },
      { name: "Signed", value: signed },
    ];
    return {
      steps: steps.map((s, i) => ({
        ...s,
        dropoff:
          i === 0 || !steps[i - 1].value ? null : ((steps[i - 1].value - s.value) / steps[i - 1].value) * 100,
      })),
      won: list.filter((d) => WON_STAGES.has(d.stage)).length,
      lost: list.filter((d) => LOST_STAGES.has(d.stage)).length,
    };
  }, [deals, funnelW.range.from, funnelW.range.to, proposals]);

  // ---------- Deal status ----------
  const stageDistribution = useMemo(() => {
    const list = byCreated(stageW.range);
    const map = new Map<string, { stage: string; label: string; count: number; value: number }>();
    for (const d of list) {
      const row = map.get(d.stage) ?? { stage: d.stage, label: stageLabel(d.stage), count: 0, value: 0 };
      row.count += 1;
      row.value += Number(d.estimated_value || 0);
      map.set(d.stage, row);
    }
    return STAGE_ORDER.map((s) => map.get(s)).filter(Boolean) as {
      stage: string;
      label: string;
      count: number;
      value: number;
    }[];
  }, [deals, stageW.range.from, stageW.range.to]);

  // ---------- Revenue over time ----------
  const revenueOverTime = useMemo(() => {
    const map = new Map<string, { month: string; value: number }>();
    for (const d of byEvent(revenueW.range)) {
      const isWon = WON_STAGES.has(d.stage);
      if (revenueMode === "booked" ? !isWon : isWon || LOST_STAGES.has(d.stage)) continue;
      const k = monthKey(d.event_date!);
      const row = map.get(k) ?? { month: k, value: 0 };
      row.value += Number(d.estimated_value || 0);
      map.set(k, row);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [deals, revenueW.range.from, revenueW.range.to, revenueMode]);

  // ---------- Weekday / month ----------
  const weekdayRows = useMemo(() => {
    const rows = WEEKDAYS.map((w) => ({ day: w, requests: 0, revenue: 0 }));
    for (const d of byCreated(weekdayW.range)) rows[new Date(d.created_at).getDay()].requests += 1;
    for (const d of byEvent(weekdayW.range)) {
      if (!WON_STAGES.has(d.stage)) continue;
      rows[new Date(d.event_date!).getDay()].revenue += Number(d.estimated_value || 0);
    }
    return rows;
  }, [deals, weekdayW.range.from, weekdayW.range.to]);

  const revenueByMonth = useMemo(() => {
    const rows = MONTHS.map((m) => ({ month: m, revenue: 0 }));
    for (const d of byEvent(weekdayW.range)) {
      if (!WON_STAGES.has(d.stage)) continue;
      rows[new Date(d.event_date!).getMonth()].revenue += Number(d.estimated_value || 0);
    }
    return rows;
  }, [deals, weekdayW.range.from, weekdayW.range.to]);

  // ---------- Velocity ----------
  const velocity = useMemo(() => {
    const list = byCreated(velocityW.range);
    const scopedIds = new Set(list.map((d) => d.id));
    const byDeal = new Map<string, Activity[]>();
    for (const a of activities) {
      if (!scopedIds.has(a.deal_id) || a.kind !== "stage_changed") continue;
      byDeal.set(a.deal_id, [...(byDeal.get(a.deal_id) ?? []), a]);
    }
    const transitions = new Map<string, number[]>();
    for (const [dealId, acts] of byDeal) {
      let prevTime = deals.find((d) => d.id === dealId)?.created_at;
      for (const a of acts) {
        const key = `${stageLabel(String(a.meta?.from ?? "new"))} → ${stageLabel(String(a.meta?.to))}`;
        if (prevTime) {
          const days = daysBetween(prevTime, a.created_at);
          if (days >= 0) transitions.set(key, [...(transitions.get(key) ?? []), days]);
        }
        prevTime = a.created_at;
      }
    }
    const rows = Array.from(transitions.entries())
      .map(([k, v]) => ({ transition: k, days: Number(avg(v)!.toFixed(1)), n: v.length }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);

    const responseDays: number[] = [];
    for (const d of list) {
      const first = proposals
        .filter((p) => p.deal_id === d.id)
        .map((p) => p.sent_at ?? p.created_at)
        .sort()[0];
      if (first) {
        const days = daysBetween(d.created_at, first);
        if (days >= 0) responseDays.push(days);
      }
    }
    return { rows, firstResponse: avg(responseDays) };
  }, [deals, velocityW.range.from, velocityW.range.to, activities, proposals]);

  // ---------- Reps ----------
  const reps = useMemo(() => {
    const map = new Map<string, { owner: string; deals: number; won: number; revenue: number }>();
    for (const d of byCreated(repsW.range)) {
      const row = map.get(d.owner_id) ?? { owner: d.owner_id, deals: 0, won: 0, revenue: 0 };
      row.deals += 1;
      if (WON_STAGES.has(d.stage)) {
        row.won += 1;
        row.revenue += Number(d.estimated_value || 0);
      }
      map.set(d.owner_id, row);
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, name: `${r.owner.slice(0, 8)}…`, winPct: r.deals ? (r.won / r.deals) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [deals, repsW.range.from, repsW.range.to]);

  const funnelMax = funnel.steps[0]?.value || 1;

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description="Leads, conversion, revenue and velocity across your pipeline."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label>Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="quarter">This quarter</SelectItem>
                <SelectItem value="year">This year</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {globalRange.from} → {globalRange.to}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading analytics…</div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="New leads"
              value={String(kpis.leads)}
              series={spark.leads}
              delta={deltaPct(kpis.leads, prevKpis.leads)}
            />
            <KpiCard
              label="Conversion rate"
              value={`${kpis.conversion.toFixed(1)}%`}
              hint={`${kpis.wonCount} won / ${kpis.leads} leads`}
              series={spark.conversion}
              delta={deltaPct(kpis.conversion, prevKpis.conversion)}
            />
            <KpiCard
              label="Booked revenue"
              value={money(kpis.bookedRevenue, currency)}
              series={spark.booked}
              delta={deltaPct(kpis.bookedRevenue, prevKpis.bookedRevenue)}
            />
            <KpiCard
              label="Open pipeline"
              value={money(kpis.pipeline, currency)}
              series={spark.pipeline}
              delta={deltaPct(kpis.pipeline, prevKpis.pipeline)}
            />
            <KpiCard
              label="Average deal size"
              value={money(kpis.avgDeal, currency)}
              series={spark.avgDeal}
              delta={deltaPct(kpis.avgDeal, prevKpis.avgDeal)}
            />
            <KpiCard
              label="Avg. days to win"
              value={kpis.avgDaysToWin == null ? "—" : `${kpis.avgDaysToWin.toFixed(1)} d`}
              series={spark.daysToWin}
              delta={deltaPct(kpis.avgDaysToWin ?? 0, prevKpis.avgDaysToWin ?? 0)}
              invert
            />
          </div>

          {/* Leads over time */}
          <Card className="overflow-hidden p-0">
            <WidgetHeader title="Leads over time">
              {leadsW.control}
              <ChartTypeToggle
                value={leadsChart}
                onChange={setLeadsChart}
                options={[
                  { value: "bar", label: "Bar" },
                  { value: "line", label: "Line" },
                ]}
              />
            </WidgetHeader>
            <CardContent className="h-72 p-4">
              {leadsOverTime.length === 0 ? (
                <EmptyState label="No leads in this period." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {leadsChart === "bar" ? (
                    <BarChart data={leadsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <RTooltip />
                      {sources.length > 1 ? (
                        <>
                          <Legend />
                          {sources.map((s, i) => (
                            <Bar key={s} dataKey={s} stackId="s" fill={CHART_COLORS[i % CHART_COLORS.length]} maxBarSize={64} />
                          ))}
                        </>
                      ) : (
                        <Bar dataKey="total" name="Leads" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={64} />
                      )}
                    </BarChart>
                  ) : (
                    <LineChart data={leadsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <RTooltip />
                      {sources.length > 1 ? (
                        <>
                          <Legend />
                          {sources.map((s, i) => (
                            <Line
                              key={s}
                              type="monotone"
                              dataKey={s}
                              stroke={CHART_COLORS[i % CHART_COLORS.length]}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                        </>
                      ) : (
                        <Line type="monotone" dataKey="total" name="Leads" stroke={CHART_COLORS[0]} strokeWidth={2} dot />
                      )}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Funnel */}
            <Card className="overflow-hidden p-0">
              <WidgetHeader title="Sales funnel">{funnelW.control}</WidgetHeader>
              <CardContent className="space-y-4 p-4">
                <div className="h-56">
                  {funnelMax === 0 ? (
                    <EmptyState />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnel.steps} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                        <RTooltip />
                        <Bar dataKey="value" name="Deals" radius={[0, 4, 4, 0]} maxBarSize={28}>
                          {funnel.steps.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-sm">
                  {funnel.steps
                    .filter((s) => s.dropoff != null)
                    .map((s) => (
                      <div key={s.name}>
                        <div className="text-xs text-muted-foreground">Drop-off → {s.name}</div>
                        <div className="font-semibold tabular-nums">{s.dropoff!.toFixed(0)}%</div>
                      </div>
                    ))}
                  <div>
                    <div className="text-xs text-muted-foreground">Won</div>
                    <div className="font-semibold tabular-nums">{funnel.won}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Lost</div>
                    <div className="font-semibold tabular-nums">{funnel.lost}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deal status */}
            <Card className="overflow-hidden p-0">
              <WidgetHeader title="Deal status">
                {stageW.control}
                <ChartTypeToggle
                  value={stageMetric}
                  onChange={setStageMetric}
                  options={[
                    { value: "count", label: "Count" },
                    { value: "value", label: "Value" },
                  ]}
                />
                <ChartTypeToggle
                  value={stageChart}
                  onChange={setStageChart}
                  options={[
                    { value: "donut", label: "Donut" },
                    { value: "bar", label: "Bar" },
                  ]}
                />
              </WidgetHeader>
              <CardContent className="h-72 p-4">
                {stageDistribution.length === 0 ? (
                  <EmptyState label="No deals in this period." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {stageChart === "donut" ? (
                      <PieChart>
                        <RTooltip
                          formatter={(v: any) =>
                            stageMetric === "value" ? money(Number(v), currency) : String(v)
                          }
                        />
                        <Legend />
                        <Pie
                          data={stageDistribution}
                          dataKey={stageMetric}
                          nameKey="label"
                          innerRadius="45%"
                          outerRadius="75%"
                          paddingAngle={2}
                        >
                          {stageDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    ) : (
                      <BarChart data={stageDistribution}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} height={60} textAnchor="end" />
                        <YAxis tick={{ fontSize: 12 }} width={stageMetric === "value" ? 80 : 40} />
                        <RTooltip
                          formatter={(v: any) =>
                            stageMetric === "value" ? money(Number(v), currency) : String(v)
                          }
                        />
                        <Bar dataKey={stageMetric} radius={[4, 4, 0, 0]} maxBarSize={48}>
                          {stageDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue over time */}
          <Card className="overflow-hidden p-0">
            <WidgetHeader title="Revenue over time (by event month)">
              {revenueW.control}
              <ChartTypeToggle
                value={revenueMode}
                onChange={setRevenueMode}
                options={[
                  { value: "booked", label: "Booked" },
                  { value: "pipeline", label: "Pipeline" },
                ]}
              />
              <ChartTypeToggle
                value={revenueChart}
                onChange={setRevenueChart}
                options={[
                  { value: "area", label: "Area" },
                  { value: "line", label: "Line" },
                  { value: "bar", label: "Bar" },
                ]}
              />
            </WidgetHeader>
            <CardContent className="h-72 p-4">
              {revenueOverTime.length === 0 ? (
                <EmptyState label="No revenue in this period." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {revenueChart === "area" ? (
                    <AreaChart data={revenueOverTime}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={80} />
                      <RTooltip formatter={(v: any) => money(Number(v), currency)} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name={revenueMode === "booked" ? "Booked" : "Pipeline"}
                        stroke={CHART_COLORS[0]}
                        fill="hsl(var(--primary) / 0.18)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  ) : revenueChart === "line" ? (
                    <LineChart data={revenueOverTime}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={80} />
                      <RTooltip formatter={(v: any) => money(Number(v), currency)} />
                      <Line type="monotone" dataKey="value" name="Revenue" stroke={CHART_COLORS[0]} strokeWidth={2} dot />
                    </LineChart>
                  ) : (
                    <BarChart data={revenueOverTime}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={80} />
                      <RTooltip formatter={(v: any) => money(Number(v), currency)} />
                      <Bar dataKey="value" name="Revenue" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Weekday + month */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="overflow-hidden p-0">
              <WidgetHeader title="By weekday">
                {weekdayW.control}
                <ChartTypeToggle
                  value={weekdayMetric}
                  onChange={setWeekdayMetric}
                  options={[
                    { value: "requests", label: "Requests" },
                    { value: "revenue", label: "Revenue" },
                  ]}
                />
              </WidgetHeader>
              <CardContent className="h-64 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      width={weekdayMetric === "revenue" ? 80 : 40}
                      allowDecimals={false}
                    />
                    <RTooltip
                      formatter={(v: any) =>
                        weekdayMetric === "revenue" ? money(Number(v), currency) : String(v)
                      }
                    />
                    <Bar
                      dataKey={weekdayMetric}
                      name={weekdayMetric === "revenue" ? "Event revenue" : "Requests"}
                      fill={weekdayMetric === "revenue" ? CHART_COLORS[2] : CHART_COLORS[0]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="overflow-hidden p-0">
              <WidgetHeader title="Event revenue by month" />
              <CardContent className="h-64 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={80} />
                    <RTooltip formatter={(v: any) => money(Number(v), currency)} />
                    <Bar dataKey="revenue" name="Event revenue" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Velocity */}
          <Card className="overflow-hidden p-0">
            <WidgetHeader title="Velocity">{velocityW.control}</WidgetHeader>
            <CardContent className="space-y-4 p-4">
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                Average lead → first proposal:{" "}
                <span className="font-semibold tabular-nums">
                  {velocity.firstResponse == null ? "—" : `${velocity.firstResponse.toFixed(1)} days`}
                </span>
              </div>
              {velocity.rows.length === 0 ? (
                <EmptyState label="No stage transitions in this period." />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={velocity.rows} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 12 }} unit="d" />
                      <YAxis type="category" dataKey="transition" width={220} tick={{ fontSize: 11 }} />
                      <RTooltip formatter={(v: any) => `${v} days`} />
                      <Bar dataKey="days" name="Avg days" fill={CHART_COLORS[4]} radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reps */}
          {members.length > 1 && (
            <Card className="overflow-hidden p-0">
              <WidgetHeader title="Sales rep performance">{repsW.control}</WidgetHeader>
              <CardContent className="space-y-4 p-4">
                {reps.length === 0 ? (
                  <EmptyState />
                ) : (
                  <>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reps}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 12 }} width={80} />
                          <RTooltip formatter={(v: any, n: any) => (n === "Revenue" ? money(Number(v), currency) : String(v))} />
                          <Legend />
                          <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={48} />
                          <Bar dataKey="deals" name="Deals" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-1">Owner</th>
                          <th className="py-1 text-right">Deals</th>
                          <th className="py-1 text-right">Win %</th>
                          <th className="py-1 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reps.map((r) => (
                          <tr key={r.owner} className="border-t">
                            <td className="py-1.5 font-mono text-xs">{r.name}</td>
                            <td className="py-1.5 text-right tabular-nums">{r.deals}</td>
                            <td className="py-1.5 text-right tabular-nums">{r.winPct.toFixed(0)}%</td>
                            <td className="py-1.5 text-right tabular-nums">{money(r.revenue, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <ItemAnalytics currency={currency} range={globalRange} deals={deals} />

          {canViewCosts && (
            <Card className="overflow-hidden p-0">
              <WidgetHeader title="Internal — revenue quality" />
              <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
                <KpiCard label="Won deals" value={String(kpis.wonCount)} />
                <KpiCard label="Booked revenue" value={money(kpis.bookedRevenue, currency)} />
                <KpiCard
                  label="Avg. revenue per lead"
                  value={money(kpis.leads ? kpis.bookedRevenue / kpis.leads : 0, currency)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
