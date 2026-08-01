import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, Legend, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/pricing";
import { useCanViewCosts } from "@/lib/cost-visibility";
import { backfillDealItems } from "@/lib/deal-items.functions";
import { toast } from "sonner";

type Item = {
  deal_id: string;
  item_type: "space" | "package" | "extra" | "staff";
  item_id: string | null;
  item_name: string;
  space_id: string | null;
  qty: number;
  line_total: number;
  line_gross: number;
  line_cost: number | null;
};

type DealRef = { id: string; event_date: string | null; created_at: string };

function pct(n: number, d: number) {
  return d > 0 ? (n / d) * 100 : 0;
}

export function ItemAnalytics({
  currency,
  range,
  deals,
}: {
  currency: string;
  range: { from: string; to: string };
  deals: DealRef[];
}) {
  const { canViewCosts } = useCanViewCosts();
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("deal_items_visible" as any)
      .select("deal_id, item_type, item_id, item_name, space_id, qty, line_total, line_gross, line_cost")
      .limit(20000);
    setItems(((data as any[]) ?? []) as Item[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function rebuild() {
    setBusy(true);
    try {
      const res = await backfillDealItems({ data: undefined as never });
      await load();
      toast.success(`Rebuilt ${res.rows} item rows across ${res.processed} of ${res.deals} won deals.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Rebuild failed");
    } finally {
      setBusy(false);
    }
  }

  const dealsInRange = useMemo(() => {
    const m = new Map<string, DealRef>();
    for (const d of deals) {
      const day = (d.event_date ?? d.created_at).slice(0, 10);
      if (day >= range.from && day <= range.to) m.set(d.id, d);
    }
    return m;
  }, [deals, range.from, range.to]);

  const scoped = useMemo(
    () => (items ?? []).filter((i) => dealsInRange.has(i.deal_id)),
    [items, dealsInRange],
  );

  const bookedDealIds = useMemo(() => new Set(scoped.map((i) => i.deal_id)), [scoped]);

  const spaceRows = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; cost: number; bookings: Set<string> }>();
    for (const i of scoped) {
      const key = i.space_id ?? "none";
      const row = map.get(key) ?? {
        name: i.item_type === "space" ? i.item_name : "Unassigned",
        revenue: 0,
        cost: 0,
        bookings: new Set<string>(),
      };
      if (i.item_type === "space") row.name = i.item_name;
      row.revenue += Number(i.line_total || 0);
      row.cost += Number(i.line_cost || 0);
      row.bookings.add(i.deal_id);
      map.set(key, row);
    }
    return Array.from(map.values())
      .map((r) => ({
        name: r.name,
        revenue: Math.round(r.revenue),
        cost: Math.round(r.cost),
        margin: Math.round(r.revenue - r.cost),
        marginPct: pct(r.revenue - r.cost, r.revenue),
        bookings: r.bookings.size,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [scoped]);

  function topItems(type: Item["item_type"]) {
    const map = new Map<string, { name: string; count: number; revenue: number; cost: number }>();
    for (const i of scoped) {
      if (i.item_type !== type) continue;
      const key = i.item_id ?? i.item_name;
      const row = map.get(key) ?? { name: i.item_name, count: 0, revenue: 0, cost: 0 };
      row.count += 1;
      row.revenue += Number(i.line_total || 0);
      row.cost += Number(i.line_cost || 0);
      map.set(key, row);
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  const packages = useMemo(() => topItems("package"), [scoped]);
  const extras = useMemo(() => topItems("extra"), [scoped]);
  const staff = useMemo(() => topItems("staff"), [scoped]);

  const overall = useMemo(() => {
    const revenue = scoped.reduce((s, i) => s + Number(i.line_total || 0), 0);
    const cost = scoped.reduce((s, i) => s + Number(i.line_cost || 0), 0);
    const dealsWithExtras = new Set(scoped.filter((i) => i.item_type === "extra").map((i) => i.deal_id));
    const dealsWithStaff = new Set(scoped.filter((i) => i.item_type === "staff").map((i) => i.deal_id));
    const addOnValue = scoped
      .filter((i) => i.item_type === "extra" || i.item_type === "staff")
      .reduce((s, i) => s + Number(i.line_total || 0), 0);
    const n = bookedDealIds.size;
    return {
      revenue,
      cost,
      margin: revenue - cost,
      marginPct: pct(revenue - cost, revenue),
      bookedDeals: n,
      extrasAttach: pct(dealsWithExtras.size, n),
      staffAttach: pct(dealsWithStaff.size, n),
      avgAddOn: n ? addOnValue / n : 0,
    };
  }, [scoped, bookedDealIds]);

  const marginOverTime = useMemo(() => {
    const dateOf = new Map(deals.map((d) => [d.id, (d.event_date ?? d.created_at).slice(0, 7)]));
    const map = new Map<string, { month: string; revenue: number; cost: number }>();
    for (const i of scoped) {
      const k = dateOf.get(i.deal_id) ?? "—";
      const row = map.get(k) ?? { month: k, revenue: 0, cost: 0 };
      row.revenue += Number(i.line_total || 0);
      row.cost += Number(i.line_cost || 0);
      map.set(k, row);
    }
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({ month: r.month, marginPct: Number(pct(r.revenue - r.cost, r.revenue).toFixed(1)) }));
  }, [scoped, deals]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Items & margin</CardTitle>
              <p className="text-sm text-muted-foreground">
                Snapshot of what was actually sold on booked deals. Internal only.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={rebuild} disabled={busy}>
              {busy ? "Rebuilding…" : "Rebuild item analytics"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Booked deals with items" value={String(overall.bookedDeals)} />
          <Stat label="Extras attach rate" value={`${overall.extrasAttach.toFixed(0)}%`} />
          <Stat label="Staffing attach rate" value={`${overall.staffAttach.toFixed(0)}%`} />
          <Stat label="Avg. add-on value / deal" value={money(overall.avgAddOn, currency)} />
          {canViewCosts && (
            <>
              <Stat label="Item revenue (net)" value={money(overall.revenue, currency)} />
              <Stat label="Item cost" value={money(overall.cost, currency)} />
              <Stat label="Gross margin" value={money(overall.margin, currency)} />
              <Stat label="Gross margin %" value={`${overall.marginPct.toFixed(1)}%`} />
            </>
          )}
        </CardContent>
      </Card>

      {items !== null && scoped.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No item snapshots in this period yet. Use “Rebuild item analytics” to backfill from won deals.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {canViewCosts ? "Revenue & margin per space" : "Revenue per space"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spaceRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RTooltip formatter={(v: any) => money(Number(v), currency)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" maxBarSize={48} radius={[4, 4, 0, 0]} />
                {canViewCosts && (
                  <Bar dataKey="margin" name="Margin" fill="hsl(160 60% 45%)" maxBarSize={48} radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Space utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1">Space</th>
                  <th className="py-1 text-right">Bookings</th>
                  <th className="py-1 text-right">Revenue</th>
                  {canViewCosts && <th className="py-1 text-right">Margin %</th>}
                </tr>
              </thead>
              <tbody>
                {spaceRows.map((r) => (
                  <tr key={r.name} className="border-t">
                    <td className="py-1.5">{r.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.bookings}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(r.revenue, currency)}</td>
                    {canViewCosts && (
                      <td className="py-1.5 text-right tabular-nums">{r.marginPct.toFixed(1)}%</td>
                    )}
                  </tr>
                ))}
                {spaceRows.length === 0 && (
                  <tr>
                    <td className="py-2 text-muted-foreground" colSpan={4}>
                      No data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {canViewCosts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gross margin % over time</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginOverTime}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <RTooltip formatter={(v: any) => `${v}%`} />
                <Line type="monotone" dataKey="marginPct" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <TopTable title="Best-selling packages" rows={packages} currency={currency} showMargin={canViewCosts} />
        <TopTable title="Best-selling extras" rows={extras} currency={currency} showMargin={canViewCosts} />
        <TopTable title="Most-booked staffing" rows={staff} currency={currency} showMargin={canViewCosts} />
      </div>
    </div>
  );
}

function TopTable({
  title,
  rows,
  currency,
  showMargin,
}: {
  title: string;
  rows: { name: string; count: number; revenue: number; cost: number }[];
  currency: string;
  showMargin: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-1">Item</th>
              <th className="py-1 text-right">#</th>
              <th className="py-1 text-right">Revenue</th>
              {showMargin && <th className="py-1 text-right">Margin</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t">
                <td className="py-1.5">{r.name}</td>
                <td className="py-1.5 text-right tabular-nums">{r.count}</td>
                <td className="py-1.5 text-right tabular-nums">{money(r.revenue, currency)}</td>
                {showMargin && (
                  <td className="py-1.5 text-right tabular-nums">
                    {money(r.revenue - r.cost, currency)}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({pct(r.revenue - r.cost, r.revenue).toFixed(0)}%)
                    </span>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="py-2 text-muted-foreground" colSpan={4}>
                  No data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
