import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
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

type Activity = {
  deal_id: string;
  kind: string;
  meta: any;
  created_at: string;
};

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
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function monthKey(iso: string) {
  return iso.slice(0, 7);
}
function daysBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}
function avg(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function periodRange(period: string, from: string, to: string) {
  const now = new Date();
  const y = now.getFullYear();
  if (period === "month") return { from: iso(new Date(y, now.getMonth(), 1)), to: iso(new Date(y, now.getMonth() + 1, 0)) };
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: iso(new Date(y, q * 3, 1)), to: iso(new Date(y, q * 3 + 3, 0)) };
  }
  if (period === "year") return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
  return { from, to };
}

function AnalyticsPage() {
  const currency = useCompanyCurrency();
  const { canViewCosts } = useCanViewCosts();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [members, setMembers] = useState<{ user_id: string; role: string }[]>([]);

  const [period, setPeriod] = useState("year");
  const today = new Date();
  const [customFrom, setCustomFrom] = useState(iso(new Date(today.getFullYear(), 0, 1)));
  const [customTo, setCustomTo] = useState(iso(today));
  const [revenueMode, setRevenueMode] = useState<"booked" | "pipeline">("booked");

  const range = periodRange(period, customFrom, customTo);

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

  const inRange = (dateStr: string | null) => {
    if (!dateStr) return false;
    const day = dateStr.slice(0, 10);
    return day >= range.from && day <= range.to;
  };

  const scoped = useMemo(() => deals.filter((d) => inRange(d.created_at)), [deals, range.from, range.to]);
  const scopedByEvent = useMemo(
    () => deals.filter((d) => inRange(d.event_date)),
    [deals, range.from, range.to],
  );

  const kpis = useMemo(() => {
    const leads = scoped.length;
    const won = scoped.filter((d) => WON_STAGES.has(d.stage));
    const open = scoped.filter((d) => !WON_STAGES.has(d.stage) && !LOST_STAGES.has(d.stage));
    const bookedRevenue = won.reduce((s, d) => s + Number(d.estimated_value || 0), 0);
    const pipeline = open.reduce((s, d) => s + Number(d.estimated_value || 0), 0);
    const wonIds = new Set(won.map((d) => d.id));
    const winDays: number[] = [];
    for (const d of won) {
      const winAct = activities.find(
        (a) => a.deal_id === d.id && a.kind === "stage_changed" && WON_STAGES.has(String(a.meta?.to)),
      );
      winDays.push(daysBetween(d.created_at, winAct?.created_at ?? d.updated_at));
    }
    return {
      leads,
      conversion: leads ? (won.length / leads) * 100 : 0,
      bookedRevenue,
      pipeline,
      avgDeal: won.length ? bookedRevenue / won.length : 0,
      avgDaysToWin: avg(winDays.filter((n) => n >= 0)),
      wonCount: won.length,
      lostCount: scoped.filter((d) => LOST_STAGES.has(d.stage)).length,
      wonIds,
    };
  }, [scoped, activities]);

  const sources = useMemo(() => {
    const s = new Set(scoped.map((d) => d.source || "manual"));
    return Array.from(s).slice(0, 6);
  }, [scoped]);

  const leadsOverTime = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of scoped) {
      const k = monthKey(d.created_at);
      const row = map.get(k) ?? { month: k, total: 0 };
      row.total += 1;
      const src = d.source || "manual";
      row[src] = (row[src] ?? 0) + 1;
      map.set(k, row);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [scoped]);

  const funnel = useMemo(() => {
    const reached = (stages: string[], idx: number) =>
      scoped.filter((d) => {
        if (stages.includes(d.stage)) return true;
        const order = ["inquiry", "proposal_sent", "client_approved", "signed"];
        // count deals that ever passed the stage via activities
        return activities.some(
          (a) => a.deal_id === d.id && a.kind === "stage_changed" && order.indexOf(String(a.meta?.to)) >= idx,
        );
      }).length;
    const leads = scoped.length;
    const proposalSent = scoped.filter(
      (d) =>
        proposals.some((p) => p.deal_id === d.id && p.sent_at) ||
        ["proposal_sent", "changes_requested", "client_approved", "signed", "waiting_payment", "invoice_sent", "downpayment_received", "paid_in_full", "payment_delayed"].includes(d.stage),
    ).length;
    const approved = scoped.filter((d) => WON_STAGES.has(d.stage)).length;
    const signed = scoped.filter((d) =>
      ["signed", "waiting_payment", "invoice_sent", "downpayment_received", "paid_in_full", "payment_delayed", "accepted"].includes(d.stage),
    ).length;
    const steps = [
      { name: "Leads", value: leads },
      { name: "Proposal sent", value: proposalSent },
      { name: "Client approved", value: approved },
      { name: "Signed", value: signed },
    ];
    return steps.map((s, i) => ({
      ...s,
      dropoff:
        i === 0 || !steps[i - 1].value ? null : ((steps[i - 1].value - s.value) / steps[i - 1].value) * 100,
    }));
  }, [scoped, proposals, activities]);

  const stageDistribution = useMemo(() => {
    const map = new Map<string, { stage: string; label: string; count: number; value: number }>();
    for (const d of scoped) {
      const row = map.get(d.stage) ?? { stage: d.stage, label: stageLabel(d.stage), count: 0, value: 0 };
      row.count += 1;
      row.value += Number(d.estimated_value || 0);
      map.set(d.stage, row);
    }
    return STAGE_ORDER.map((s) => map.get(s)).filter(Boolean) as any[];
  }, [scoped]);

  const revenueOverTime = useMemo(() => {
    const map = new Map<string, { month: string; value: number }>();
    for (const d of scopedByEvent) {
      const isWon = WON_STAGES.has(d.stage);
      if (revenueMode === "booked" ? !isWon : isWon || LOST_STAGES.has(d.stage)) continue;
      const k = monthKey(d.event_date!);
      const row = map.get(k) ?? { month: k, value: 0 };
      row.value += Number(d.estimated_value || 0);
      map.set(k, row);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [scopedByEvent, revenueMode]);

  const requestsByWeekday = useMemo(() => {
    const counts = WEEKDAYS.map((w) => ({ day: w, requests: 0 }));
    for (const d of scoped) counts[new Date(d.created_at).getDay()].requests += 1;
    return counts;
  }, [scoped]);

  const revenueByWeekday = useMemo(() => {
    const rows = WEEKDAYS.map((w) => ({ day: w, revenue: 0 }));
    for (const d of scopedByEvent) {
      if (!WON_STAGES.has(d.stage)) continue;
      rows[new Date(d.event_date!).getDay()].revenue += Number(d.estimated_value || 0);
    }
    return rows;
  }, [scopedByEvent]);

  const revenueByMonth = useMemo(() => {
    const rows = MONTHS.map((m) => ({ month: m, revenue: 0 }));
    for (const d of scopedByEvent) {
      if (!WON_STAGES.has(d.stage)) continue;
      rows[new Date(d.event_date!).getMonth()].revenue += Number(d.estimated_value || 0);
    }
    return rows;
  }, [scopedByEvent]);

  const velocity = useMemo(() => {
    const scopedIds = new Set(scoped.map((d) => d.id));
    const byDeal = new Map<string, Activity[]>();
    for (const a of activities) {
      if (!scopedIds.has(a.deal_id) || a.kind !== "stage_changed") continue;
      const list = byDeal.get(a.deal_id) ?? [];
      list.push(a);
      byDeal.set(a.deal_id, list);
    }
    const transitions = new Map<string, number[]>();
    for (const [dealId, list] of byDeal) {
      const created = deals.find((d) => d.id === dealId)?.created_at;
      let prevTime = created;
      for (const a of list) {
        const key = `${stageLabel(String(a.meta?.from ?? "new"))} → ${stageLabel(String(a.meta?.to))}`;
        if (prevTime) {
          const days = daysBetween(prevTime, a.created_at);
          if (days >= 0) transitions.set(key, [...(transitions.get(key) ?? []), days]);
        }
        prevTime = a.created_at;
      }
    }
    const rows = Array.from(transitions.entries())
      .map(([k, v]) => ({ transition: k, days: avg(v)!, n: v.length }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);

    const responseDays: number[] = [];
    for (const d of scoped) {
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
  }, [scoped, activities, proposals, deals]);

  const reps = useMemo(() => {
    const map = new Map<string, { owner: string; deals: number; won: number; revenue: number }>();
    for (const d of scoped) {
      const row = map.get(d.owner_id) ?? { owner: d.owner_id, deals: 0, won: 0, revenue: 0 };
      row.deals += 1;
      if (WON_STAGES.has(d.stage)) {
        row.won += 1;
        row.revenue += Number(d.estimated_value || 0);
      }
      map.set(d.owner_id, row);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [scoped]);

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
            {range.from} → {range.to}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading analytics…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi label="New leads" value={String(kpis.leads)} />
            <Kpi label="Conversion rate" value={`${kpis.conversion.toFixed(1)}%`} hint={`${kpis.wonCount} won / ${kpis.leads} leads`} />
            <Kpi label="Booked revenue" value={money(kpis.bookedRevenue, currency)} />
            <Kpi label="Open pipeline" value={money(kpis.pipeline, currency)} />
            <Kpi label="Average deal size" value={money(kpis.avgDeal, currency)} />
            <Kpi
              label="Avg. days to win"
              value={kpis.avgDaysToWin == null ? "—" : `${kpis.avgDaysToWin.toFixed(1)} d`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leads over time</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
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
                    <Bar dataKey="total" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={64} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {funnel.map((s) => {
                  const max = funnel[0].value || 1;
                  return (
                    <div key={s.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span>{s.name}</span>
                        <span className="tabular-nums">
                          {s.value}
                          {s.dropoff != null && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              −{s.dropoff.toFixed(0)}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 rounded bg-muted">
                        <div
                          className="h-2 rounded bg-primary"
                          style={{ width: `${Math.min(100, (s.value / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-6 border-t pt-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Won</div>
                    <div className="font-semibold tabular-nums">{kpis.wonCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Lost</div>
                    <div className="font-semibold tabular-nums">{kpis.lostCount}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deal status distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stageDistribution.length === 0 && (
                    <div className="text-sm text-muted-foreground">No deals in this period.</div>
                  )}
                  {stageDistribution.map((s) => (
                    <div key={s.stage} className="flex items-center justify-between text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {s.count} · {money(s.value, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Revenue over time (by event month)</CardTitle>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={revenueMode === "booked" ? "default" : "outline"}
                  onClick={() => setRevenueMode("booked")}
                >
                  Booked
                </Button>
                <Button
                  size="sm"
                  variant={revenueMode === "pipeline" ? "default" : "outline"}
                  onClick={() => setRevenueMode("pipeline")}
                >
                  Pipeline
                </Button>
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={80} />
                  <RTooltip formatter={(v: any) => money(Number(v), currency)} />
                  <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Requests by weekday (created)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={requestsByWeekday}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <RTooltip />
                    <Bar dataKey="requests" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {requestsByWeekday.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[0]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Event revenue by weekday</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByWeekday}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={80} />
                    <RTooltip formatter={(v: any) => money(Number(v), currency)} />
                    <Bar dataKey="revenue" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event revenue by month</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={80} />
                  <RTooltip formatter={(v: any) => money(Number(v), currency)} />
                  <Bar dataKey="revenue" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Velocity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                Average lead → first proposal:{" "}
                <span className="font-semibold tabular-nums">
                  {velocity.firstResponse == null ? "—" : `${velocity.firstResponse.toFixed(1)} days`}
                </span>
              </div>
              {velocity.rows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No stage transitions in this period.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1">Transition</th>
                      <th className="py-1 text-right">Avg days</th>
                      <th className="py-1 text-right">Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {velocity.rows.map((r) => (
                      <tr key={r.transition} className="border-t">
                        <td className="py-1.5">{r.transition}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.days.toFixed(1)}</td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{r.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {members.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales rep performance</CardTitle>
              </CardHeader>
              <CardContent>
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
                        <td className="py-1.5 font-mono text-xs">{r.owner.slice(0, 8)}…</td>
                        <td className="py-1.5 text-right tabular-nums">{r.deals}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {r.deals ? ((r.won / r.deals) * 100).toFixed(0) : 0}%
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{money(r.revenue, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {canViewCosts && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal — revenue quality</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <Kpi label="Won deals" value={String(kpis.wonCount)} />
                <Kpi label="Booked revenue" value={money(kpis.bookedRevenue, currency)} />
                <Kpi
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

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
