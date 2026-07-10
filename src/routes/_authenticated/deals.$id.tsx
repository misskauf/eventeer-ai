import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  computeTotals,
  money,
  type Offer,
  type Selection,
  type SpaceSel,
  type PackageSel,
  type ExtraSel,
} from "@/lib/pricing";
import { categoryDefaultHours, type CategoryDefaults } from "@/lib/tax";

import { randomToken } from "@/lib/auth-hooks";
import { toast } from "sonner";
import { ArrowLeft, Copy, Send, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/deals/$id")({
  component: DealDetail,
});

type Deal = {
  id: string;
  company_id: string;
  client_name: string;
  client_email: string;
  client_company: string | null;
  event_type: string | null;
  event_date: string | null;
  guest_count: number;
  stage: string;
  estimated_value: number;
  notes: string | null;
};

type Season = { id: string; name: string; multiplier: number };

function DealDetail() {
  const { id } = Route.useParams();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [spaces, setSpaces] = useState<SpaceSel[]>([]);
  const [packages, setPackages] = useState<PackageSel[]>([]);
  const [extras, setExtras] = useState<ExtraSel[]>([]);
  const [fees, setFees] = useState<any>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currency, setCurrency] = useState("USD");

  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [packageGuests, setPackageGuests] = useState<Record<string, number>>({});
  const [packageHours, setPackageHours] = useState<Record<string, number>>({});

  const [seasonId, setSeasonId] = useState<string>("none");
  const [discount, setDiscount] = useState(0);
  const [minRevenue, setMinRevenue] = useState(0);
  const [clientMessage, setClientMessage] = useState("");
  const [activities, setActivities] = useState<any[]>([]);
  const [existingProposal, setExistingProposal] = useState<any>(null);

  async function loadAll() {
    const { data: d } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    if (!d) return;
    setDeal(d as Deal);
    const [sp, pk, ex, fc, ss, co, ac, pr] = await Promise.all([
      supabase.from("spaces").select("id, name, base_rental_fee, min_rental_fee, basis, tax_rate_pct, long_description").eq("active", true),
      supabase.from("fb_packages").select("id, name, price_per_person, kind, basis, tax_rate_pct, long_description, included_hours, overage_price_per_person_per_hour").eq("active", true),
      supabase.from("extras").select("id, name, pricing_type, price, basis, tax_rate_pct, long_description").eq("active", true),
      supabase.from("fee_config").select("*").eq("company_id", d.company_id).maybeSingle(),
      supabase.from("pricing_seasons").select("id, name, multiplier"),
      supabase.from("companies").select("currency").eq("id", d.company_id).maybeSingle(),
      supabase.from("deal_activities").select("*").eq("deal_id", id).order("created_at", { ascending: false }),
      supabase.from("proposals").select("*").eq("deal_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSpaces((sp.data as SpaceSel[]) ?? []);
    setPackages((pk.data as PackageSel[]) ?? []);
    setExtras((ex.data as ExtraSel[]) ?? []);
    setFees(fc.data ?? {
      service_charge_pct: 0, tax_pct: 0, cleaning_fee: 0, overtime_fee_per_hour: 0,
    });
    setSeasons((ss.data as Season[]) ?? []);
    if (co.data?.currency) setCurrency(co.data.currency);
    setActivities(ac.data ?? []);
    if (pr.data) {
      setExistingProposal(pr.data);
      const cfg = (pr.data.offer as any) ?? {};
      const cons = (pr.data.constraints as any) ?? {};
      setSelectedSpaces(cfg.space_ids ?? []);
      setSelectedPackages(cfg.package_ids ?? []);
      setSelectedExtras(cfg.extra_ids ?? []);
      setPackageGuests(cfg.package_guests ?? {});
      setPackageHours(cfg.package_hours ?? {});

      setSeasonId(cfg.season_id ?? "none");
      setDiscount(cfg.discount ?? 0);
      setMinRevenue(cfg.min_revenue_required ?? 0);
      setClientMessage(cons.client_message ?? "");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const seasonMult = useMemo(
    () => seasons.find((s) => s.id === seasonId)?.multiplier ?? 1,
    [seasonId, seasons],
  );

  const offer: Offer | null = useMemo(() => {
    if (!fees) return null;
    return {
      spaces, packages, extras,
      fees: { ...fees, overtime_hours: 0 },
      category_defaults: fees as CategoryDefaults,
      season_multiplier: seasonMult,
      min_revenue_required: minRevenue,
      discount,
    };
  }, [spaces, packages, extras, fees, seasonMult, discount, minRevenue]);

  const selection: Selection = {
    guest_count: deal?.guest_count ?? 0,
    space_ids: selectedSpaces,
    package_ids: selectedPackages,
    extra_ids: selectedExtras,
    package_guests: packageGuests,
    package_hours: packageHours,
  };


  const totals = offer ? computeTotals(offer, selection) : null;

  const foodPackages = packages.filter((p) => (p.kind ?? "food") === "food");
  const beveragePackages = packages.filter((p) => p.kind === "beverage");

  async function saveProposal(send: boolean) {
    if (!deal || !totals) return;
    const config = {
      space_ids: selectedSpaces,
      package_ids: selectedPackages,
      extra_ids: selectedExtras,
      package_guests: packageGuests,
      package_hours: packageHours,

      season_id: seasonId,
      discount,
      min_revenue_required: minRevenue,
      guest_count: deal.guest_count,
    };
    const version = existingProposal ? existingProposal.version + 1 : 1;
    const status = send ? "sent" : "draft";
    const { data: newProp, error } = await supabase
      .from("proposals")
      .insert({
        deal_id: deal.id,
        company_id: deal.company_id,
        version,
        status,
        offer: config,
        constraints: {
          client_message: clientMessage,
          computed_net: totals.net_subtotal,
          computed_tax: totals.tax_subtotal,
          computed_total: totals.grand_total,
        },
        sent_at: send ? new Date().toISOString() : null,
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);

    let shareUrl: string | null = null;
    if (send) {
      const token = randomToken(24);
      await supabase.from("share_tokens").insert({
        token,
        kind: "client_proposal",
        deal_id: deal.id,
        proposal_id: newProp.id,
        company_id: deal.company_id,
      });
      await supabase.from("deals").update({ stage: "proposal_sent" }).eq("id", deal.id);
      await supabase.from("deal_activities").insert({
        deal_id: deal.id, company_id: deal.company_id, kind: "proposal_sent",
        meta: { version, computed_total: totals.grand_total },
      });
      shareUrl = `${window.location.origin}/p/${token}`;
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      toast.success("Proposal sent · link copied to clipboard");
    } else {
      await supabase.from("deals").update({ stage: "proposal_draft" }).eq("id", deal.id);
      toast.success(`Draft v${version} saved`);
    }
    await loadAll();
    if (shareUrl) console.log("Share link:", shareUrl);
  }

  async function shareDashboard() {
    if (!deal) return;
    const token = randomToken(24);
    await supabase.from("share_tokens").insert({
      token, kind: "dashboard", deal_id: deal.id, company_id: deal.company_id,
    });
    const url = `${window.location.origin}/d/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Dashboard link copied");
  }

  if (!deal || !offer || !totals) return <AppShell><div>Loading…</div></AppShell>;

  const setGuestOverride = (pid: string, v: number) =>
    setPackageGuests((cur) => ({ ...cur, [pid]: v }));
  const setHoursOverride = (pid: string, v: number) =>
    setPackageHours((cur) => ({ ...cur, [pid]: v }));


  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to deals
        </Link>
      </div>
      <PageHeader
        title={deal.client_name}
        description={`${deal.client_email}${deal.event_date ? " · " + new Date(deal.event_date).toLocaleDateString() : ""} · ${deal.guest_count} guests · ${deal.event_type ?? "Event"}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={shareDashboard}>
              <Copy className="mr-1 h-4 w-4" /> Share dashboard
            </Button>
            <Badge variant="secondary" className="self-center">
              {deal.stage.replace(/_/g, " ")}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Spaces</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {spaces.length === 0 && <EmptyHint to="/catalog/spaces" label="Add spaces in catalog" />}
              {spaces.map((s) => (
                <PickRow
                  key={s.id}
                  checked={selectedSpaces.includes(s.id)}
                  onChange={(v) => toggle(setSelectedSpaces, s.id, v)}
                  title={s.name}
                  subtitle={`Base ${money(s.base_rental_fee, currency)} · min ${money(s.min_rental_fee, currency)}`}
                />
              ))}
            </CardContent>
          </Card>

          <PackageCard
            title="Food packages"
            emptyTo="/catalog/food"
            items={foodPackages}
            currency={currency}
            selected={selectedPackages}
            onToggle={(id, v) => toggle(setSelectedPackages, id, v)}
            dealGuests={deal.guest_count}
            packageGuests={packageGuests}
            onGuestChange={setGuestOverride}
          />
          <PackageCard
            title="Beverage packages"
            emptyTo="/catalog/beverages"
            items={beveragePackages}
            currency={currency}
            selected={selectedPackages}
            onToggle={(id, v) => toggle(setSelectedPackages, id, v)}
            dealGuests={deal.guest_count}
            packageGuests={packageGuests}
            onGuestChange={setGuestOverride}
          />

          <Card>
            <CardHeader><CardTitle>Extras</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {extras.length === 0 && <EmptyHint to="/catalog/extras" label="Add extras in catalog" />}
              {extras.map((e) => (
                <PickRow
                  key={e.id}
                  checked={selectedExtras.includes(e.id)}
                  onChange={(v) => toggle(setSelectedExtras, e.id, v)}
                  title={e.name}
                  subtitle={`${money(e.price, currency)} · ${e.pricing_type.replace("_", " ")}`}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Client message</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={clientMessage}
                onChange={(e) => setClientMessage(e.target.value)}
                placeholder="A short personal note that appears at the top of the client proposal."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Pricing rules</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Season</Label>
                <Select value={seasonId} onValueChange={setSeasonId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No season adjustment</SelectItem>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} (×{s.multiplier})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Minimum revenue required (net)</Label>
                <Input
                  type="number"
                  value={minRevenue}
                  onChange={(e) => setMinRevenue(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount (gross)</Label>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {totals.lines.map((l, i) => (
                <div key={i} className="space-y-0.5 border-b py-1 last:border-b-0">
                  <div className="flex justify-between">
                    <span className="font-medium">{l.label}</span>
                    <span className="tabular-nums">{money(l.gross, currency)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{l.qty} · {l.basis} · tax {l.tax_rate_pct}%</span>
                    <span className="tabular-nums">
                      net {money(l.net, currency)} · tax {money(l.tax, currency)}
                    </span>
                  </div>
                </div>
              ))}
              <Separator className="my-2" />
              <Row label="Net subtotal" value={money(totals.net_subtotal, currency)} />
              <Row label="Total tax" value={money(totals.tax_subtotal, currency)} />
              <Row label="Gross subtotal" value={money(totals.gross_subtotal, currency)} />
              {discount > 0 && <Row label="Discount" value={"-" + money(discount, currency)} />}
              <Row label="Service" value={money(totals.service_charge, currency)} />
              <Separator className="my-2" />
              <Row label={<b>Grand total</b>} value={<b>{money(totals.grand_total, currency)}</b>} />
              {totals.min_shortfall > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-yellow-50 p-2 text-xs text-yellow-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <div>
                    Net minimum not met. Shortfall of {money(totals.min_shortfall, currency)}. Consider adding extras or adjusting the discount.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button onClick={() => saveProposal(false)} variant="outline">Save draft</Button>
            <Button onClick={() => saveProposal(true)}>
              <Send className="mr-1 h-4 w-4" /> Send to client
            </Button>
          </div>

          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {activities.length === 0 && <div className="text-muted-foreground">No activity yet.</div>}
              {activities.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{a.kind.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function PackageCard({
  title, emptyTo, items, currency, selected, onToggle, dealGuests, packageGuests, onGuestChange,
}: {
  title: string;
  emptyTo: string;
  items: PackageSel[];
  currency: string;
  selected: string[];
  onToggle: (id: string, v: boolean | "indeterminate") => void;
  dealGuests: number;
  packageGuests: Record<string, number>;
  onGuestChange: (id: string, v: number) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <EmptyHint to={emptyTo} label={`Add ${title.toLowerCase()} in catalog`} />}
        {items.map((p) => {
          const checked = selected.includes(p.id);
          const guests = packageGuests[p.id] ?? dealGuests;
          return (
            <div key={p.id} className="rounded-md border p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={checked} onCheckedChange={(v) => onToggle(p.id, v)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{money(p.price_per_person, currency)} per guest</div>
                </div>
              </label>
              {checked && (
                <div className="mt-2 flex items-center gap-2 border-t pt-2 text-xs">
                  <span className="text-muted-foreground">Guests for this package</span>
                  <Input
                    type="number"
                    min={1}
                    value={guests}
                    onChange={(e) => onGuestChange(p.id, Math.max(1, Number(e.target.value) || 1))}
                    className="h-7 w-20"
                  />
                  {guests !== dealGuests && (
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => onGuestChange(p.id, dealGuests)}
                    >
                      reset to {dealGuests}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, id: string, v: boolean | "indeterminate") {
  setter((cur) => (v ? Array.from(new Set([...cur, id])) : cur.filter((x) => x !== id)));
}

function PickRow({
  checked, onChange, title, subtitle,
}: {
  checked: boolean;
  onChange: (v: boolean | "indeterminate") => void;
  title: string;
  subtitle: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/40">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </label>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function EmptyHint({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to as string} className="block rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/40">
      {label} →
    </Link>
  );
}
