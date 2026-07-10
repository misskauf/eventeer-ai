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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Markdown } from "@/components/markdown";
import { Slider } from "@/components/ui/slider";
import { randomToken } from "@/lib/auth-hooks";
import { toast } from "sonner";
import { ArrowLeft, Copy, Send, AlertTriangle, Eye, Pencil, Plus, Trash2, MessageSquare, Sparkles, Receipt, CheckCircle2 } from "lucide-react";
import { stageLabel } from "@/lib/deal-stages";
import { formatEventDate, weekdayOf, pickMinRevRule, type MinRevRule } from "@/lib/date-format";

export const Route = createFileRoute("/_authenticated/deals_/$id")({
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
type SpaceRow = SpaceSel & { available_days?: number[] | null };

type AlternativeGroup = {
  id: string;
  name: string;
  category: "space" | "food" | "beverage" | "extra";
  item_ids: string[];
  default_id: string;
};

function newGroupId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function DealDetail() {
  const { id } = Route.useParams();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [packages, setPackages] = useState<PackageSel[]>([]);
  const [extras, setExtras] = useState<ExtraSel[]>([]);
  const [fees, setFees] = useState<any>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [minRevRules, setMinRevRules] = useState<MinRevRule[]>([]);
  const [currency, setCurrency] = useState("USD");

  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [packageGuests, setPackageGuests] = useState<Record<string, number>>({});
  const [packageHours, setPackageHours] = useState<Record<string, number>>({});

  const [seasonId, setSeasonId] = useState<string>("none");
  const [discount, setDiscount] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const [minRevenue, setMinRevenue] = useState(0);
  const [servicePct, setServicePct] = useState<number>(0);
  const [coverTitle, setCoverTitle] = useState("");
  const [coverTouched, setCoverTouched] = useState(false);
  const [introMarkdown, setIntroMarkdown] = useState("");
  const [altGroups, setAltGroups] = useState<AlternativeGroup[]>([]);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");

  const [activities, setActivities] = useState<any[]>([]);
  const [existingProposal, setExistingProposal] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

  async function loadAll() {
    const { data: d } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    if (!d) return;
    setDeal(d as Deal);
    const [sp, pk, ex, fc, ss, mr, co, ac, pr] = await Promise.all([
      supabase.from("spaces").select("id, name, base_rental_fee, min_rental_fee, basis, tax_rate_pct, long_description, available_days").eq("active", true),
      supabase.from("fb_packages").select("id, name, price_per_person, kind, basis, tax_rate_pct, long_description, included_hours, overage_price_per_person_per_hour").eq("active", true),
      supabase.from("extras").select("id, name, pricing_type, price, basis, tax_rate_pct, long_description").eq("active", true),
      supabase.from("fee_config").select("*").eq("company_id", d.company_id).maybeSingle(),
      supabase.from("pricing_seasons").select("id, name, multiplier"),
      supabase.from("pricing_rules").select("id, notes, days_of_week, months, min_revenue, basis").eq("company_id", d.company_id),
      supabase.from("companies").select("currency").eq("id", d.company_id).maybeSingle(),
      supabase.from("deal_activities").select("*").eq("deal_id", id).order("created_at", { ascending: false }),
      supabase.from("proposals").select("*").eq("deal_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSpaces((sp.data as SpaceRow[]) ?? []);
    setPackages((pk.data as PackageSel[]) ?? []);
    setExtras((ex.data as ExtraSel[]) ?? []);
    const feeRow: any = fc.data ?? {
      service_charge_pct: 0, tax_pct: 0, cleaning_fee: 0, overtime_fee_per_hour: 0,
    };
    setFees(feeRow);
    setSeasons((ss.data as Season[]) ?? []);
    const rules = (mr.data as MinRevRule[]) ?? [];
    setMinRevRules(rules);
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
      const savedDiscount = Number(cfg.discount ?? 0);
      setDiscount(savedDiscount);
      setShowDiscount(savedDiscount > 0);
      setCoverTitle(cfg.cover_title ?? "");
      setCoverTouched(!!cfg.cover_title);
      setAltGroups(cfg.alternative_groups ?? []);
      setIntroMarkdown(cons.intro_markdown ?? cons.client_message ?? "");
      const savedService = cfg.service_charge_pct_override;
      const gratDefault =
        feeRow?.gratuity_mode === "fixed"
          ? Number(feeRow?.gratuity_fixed_pct ?? 0)
          : Number(feeRow?.gratuity_default_pct ?? feeRow?.service_charge_pct ?? 0);
      setServicePct(typeof savedService === "number" ? savedService : gratDefault);
      // Prefer saved min-revenue if it was set explicitly, otherwise recompute from rules.
      const savedMin = Number(cfg.min_revenue_required ?? 0);
      const matched = pickMinRevRule(rules, d.event_date);
      setMinRevenue(savedMin || Number(matched?.min_revenue ?? 0));
    } else {
      const gratDefault =
        feeRow?.gratuity_mode === "fixed"
          ? Number(feeRow?.gratuity_fixed_pct ?? 0)
          : Number(feeRow?.gratuity_default_pct ?? feeRow?.service_charge_pct ?? 0);
      setServicePct(gratDefault);
      const matched = pickMinRevRule(rules, d.event_date);
      setMinRevenue(Number(matched?.min_revenue ?? 0));
    }

  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (window.location.hash === "#edit") setEditOpen(true);
  }, [id]);

  // Auto cover title "Your [event type] at [location] on [date]" unless the manager typed something.
  useEffect(() => {
    if (coverTouched) return;
    if (!deal) return;
    const eventType = deal.event_type?.trim();
    const stripSpaceSuffix = (name: string) =>
      name.split(/\s+(?:-|–|—|\||,|Weekday|Weekend|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\b/i)[0].trim();
    const spaceNames = spaces.filter((s) => selectedSpaces.includes(s.id)).map((s) => stripSpaceSuffix(s.name));
    const dateStr = deal.event_date ? formatEventDate(deal.event_date) : "";
    if (!eventType && !spaceNames.length && !dateStr) return;
    let title = "Your";
    if (eventType) title += ` ${eventType}`;
    if (spaceNames.length) title += ` at ${spaceNames.join(" & ")}`;
    if (dateStr) title += ` on ${dateStr}`;
    setCoverTitle(title);
  }, [deal?.event_type, deal?.event_date, coverTouched, deal, spaces, selectedSpaces]);

  const seasonMult = useMemo(
    () => seasons.find((s) => s.id === seasonId)?.multiplier ?? 1,
    [seasonId, seasons],
  );

  const matchedRule = useMemo(
    () => pickMinRevRule(minRevRules, deal?.event_date),
    [minRevRules, deal?.event_date],
  );

  // Filter spaces by day-of-week availability when the deal has an event date.
  const availableSpaces = useMemo(() => {
    const wd = weekdayOf(deal?.event_date);
    if (wd == null) return spaces;
    return spaces.filter((s) => !s.available_days || s.available_days.length === 0 || s.available_days.includes(wd));
  }, [spaces, deal?.event_date]);

  // For the manager's own totals preview, resolve each alt group to its default choice.
  const resolvedSelection = useMemo(() => {
    const extraSpaces: string[] = [];
    const extraPkgs: string[] = [];
    const extraExtras: string[] = [];
    for (const g of altGroups) {
      const target = g.default_id && g.item_ids.includes(g.default_id) ? g.default_id : g.item_ids[0];
      if (!target) continue;
      if (g.category === "space") extraSpaces.push(target);
      else if (g.category === "extra") extraExtras.push(target);
      else extraPkgs.push(target);
    }
    return {
      guest_count: deal?.guest_count ?? 0,
      space_ids: Array.from(new Set([...selectedSpaces, ...extraSpaces])),
      package_ids: Array.from(new Set([...selectedPackages, ...extraPkgs])),
      extra_ids: Array.from(new Set([...selectedExtras, ...extraExtras])),
      package_guests: packageGuests,
      package_hours: packageHours,
    } as Selection;
  }, [deal, selectedSpaces, selectedPackages, selectedExtras, packageGuests, packageHours, altGroups]);

  const effectiveDiscount = showDiscount ? discount : 0;

  const offer: Offer | null = useMemo(() => {
    if (!fees) return null;
    return {
      spaces, packages, extras,
      fees: {
        ...fees,
        service_charge_pct: servicePct,
        overtime_hours: 0,
        gratuity_type: (fees as any)?.gratuity_type ?? "service_charge",
        gratuity_tax_rate_pct: Number((fees as any)?.gratuity_tax_rate_pct ?? 0),
      },
      category_defaults: fees as CategoryDefaults,
      season_multiplier: seasonMult,
      min_revenue_required: minRevenue,
      discount: effectiveDiscount,
      currency,
    };
  }, [spaces, packages, extras, fees, seasonMult, effectiveDiscount, minRevenue, servicePct, currency]);


  const totals = offer ? computeTotals(offer, resolvedSelection) : null;

  const foodPackages = packages.filter((p) => (p.kind ?? "food") === "food");
  const beveragePackages = packages.filter((p) => p.kind === "beverage");
  const itemsForCategory = (cat: AlternativeGroup["category"]) => {
    if (cat === "space") return availableSpaces.map((s) => ({ id: s.id, name: s.name }));
    if (cat === "food") return foodPackages.map((p) => ({ id: p.id, name: p.name }));
    if (cat === "beverage") return beveragePackages.map((p) => ({ id: p.id, name: p.name }));
    return extras.map((e) => ({ id: e.id, name: e.name }));
  };


  function buildOfferConfig() {
    return {
      space_ids: selectedSpaces,
      package_ids: selectedPackages,
      extra_ids: selectedExtras,
      package_guests: packageGuests,
      package_hours: packageHours,
      season_id: seasonId,
      discount: effectiveDiscount,
      min_revenue_required: minRevenue,
      service_charge_pct_override: servicePct,
      guest_count: deal?.guest_count ?? 0,
      cover_title: coverTitle,
      alternative_groups: altGroups,
    };
  }

  function suggestIntroText() {
    if (!deal) return;
    const lines: string[] = [];
    const who = deal.client_name || "there";
    const occasion = deal.event_type ? deal.event_type.toLowerCase() : "event";
    const date = deal.event_date ? formatEventDate(deal.event_date) : "your chosen date";
    lines.push(`Hi ${who},`);
    lines.push("");
    lines.push(`Thank you for considering us for your ${occasion} on **${date}**. Here is a tailored proposal for ${deal.guest_count} guests.`);
    lines.push("");
    const spaceNames = availableSpaces.filter((s) => selectedSpaces.includes(s.id)).map((s) => s.name);
    if (spaceNames.length) lines.push(`**Venue:** ${spaceNames.join(", ")}.`);
    const foodNames = foodPackages.filter((p) => selectedPackages.includes(p.id)).map((p) => p.name);
    if (foodNames.length) lines.push(`**Food:** ${foodNames.join(", ")}.`);
    const bevNames = beveragePackages.filter((p) => selectedPackages.includes(p.id)).map((p) => p.name);
    if (bevNames.length) lines.push(`**Beverage:** ${bevNames.join(", ")}.`);
    const extraNames = extras.filter((e) => selectedExtras.includes(e.id)).map((e) => e.name);
    if (extraNames.length) lines.push(`**Extras:** ${extraNames.join(", ")}.`);
    if (altGroups.length) lines.push(`We've included a few **choices** below so you can shape the experience yourself.`);
    lines.push("");
    lines.push("Let me know what you think, or reply directly with any tweaks.");
    setIntroMarkdown(lines.join("\n"));
    toast.success("Suggested text inserted");
  }

  async function saveProposal(send: boolean): Promise<{ id: string; version: number } | null> {
    if (!deal || !totals) return null;
    const version = existingProposal ? existingProposal.version + 1 : 1;
    const status = send ? "sent" : "draft";
    const { data: newProp, error } = await supabase
      .from("proposals")
      .insert({
        deal_id: deal.id,
        company_id: deal.company_id,
        version,
        status,
        offer: buildOfferConfig(),
        constraints: {
          intro_markdown: introMarkdown,
          client_message: introMarkdown, // back-compat
          computed_net: totals.net_subtotal,
          computed_tax: totals.tax_subtotal,
          computed_total: totals.grand_total,
        },
        sent_at: send ? new Date().toISOString() : null,
      })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return null; }

    if (send) {
      const token = randomToken(24);
      await supabase.from("share_tokens").insert({
        token,
        kind: "client_proposal",
        deal_id: deal.id,
        proposal_id: newProp.id,
        company_id: deal.company_id,
      });
      await supabase.from("deals").update({ stage: "proposal_sent" as any }).eq("id", deal.id);
      await supabase.from("deal_activities").insert({
        deal_id: deal.id, company_id: deal.company_id, kind: "proposal_sent",
        meta: { version, computed_total: totals.grand_total },
      });
      const shareUrl = `${window.location.origin}/p/${token}`;
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      toast.success("Proposal sent · link copied to clipboard");
    } else {
      await supabase.from("deals").update({ stage: "proposal_draft" as any }).eq("id", deal.id);
      toast.success(`Draft v${version} saved`);
    }
    await loadAll();
    return { id: newProp.id, version };
  }

  async function previewAsClient() {
    const saved = await saveProposal(false);
    if (!saved || !deal) return;
    const token = randomToken(24);
    const { error } = await supabase.from("share_tokens").insert({
      token,
      kind: "preview" as any,
      deal_id: deal.id,
      proposal_id: saved.id,
      company_id: deal.company_id,
    });
    if (error) return toast.error(error.message);
    window.open(`/p/${token}`, "_blank", "noopener");
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

  const clientResponse = (existingProposal?.constraints as any)?.client_response as
    | {
        overall_message?: string;
        item_notes?: Record<string, string>;
        selected_alternatives?: Record<string, string>;
        submitted_at?: string;
        computed_total?: number;
      }
    | undefined;

  const itemName = (itemId: string) => {
    const s = spaces.find((x) => x.id === itemId);
    if (s) return s.name;
    const p = packages.find((x) => x.id === itemId);
    if (p) return p.name;
    const e = extras.find((x) => x.id === itemId);
    if (e) return e.name;
    return itemId;
  };

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to deals
        </Link>
      </div>
      <PageHeader
        title={deal.client_name}
        description={`${deal.client_email}${deal.event_date ? " · " + formatEventDate(deal.event_date) : ""} · ${deal.guest_count} guests · ${deal.event_type ?? "Event"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-4 w-4" /> Edit deal
            </Button>
            <Button variant="outline" onClick={shareDashboard}>
              <Copy className="mr-1 h-4 w-4" /> Share dashboard
            </Button>
            <Badge variant="secondary" className="self-center">
              {stageLabel(deal.stage)}
            </Badge>
          </div>
        }
      />

      <EditDealDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        deal={deal}
        onSaved={loadAll}
      />

      {/* DEAL SECTION */}
      <Card
        className="mb-6 cursor-pointer transition hover:border-primary hover:shadow-sm"
        onClick={() => setEditOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") setEditOpen(true); }}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Deal details</CardTitle>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" /> Click to edit
          </span>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Detail label="Client">{deal.client_name}</Detail>
          <Detail label="Email">{deal.client_email}</Detail>
          <Detail label="Company">{deal.client_company || "—"}</Detail>
          <Detail label="Event type">{deal.event_type || "—"}</Detail>
          <Detail label="Event date">{deal.event_date ? formatEventDate(deal.event_date) : "—"}</Detail>
          <Detail label="Guests">{deal.guest_count || "—"}</Detail>
          <Detail label="Stage">{stageLabel(deal.stage)}</Detail>
          <Detail label="Estimated value">{money(Number(deal.estimated_value), currency)}</Detail>
          {deal.notes && (
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
              <div className="mt-1 whitespace-pre-wrap">{deal.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CLIENT RESPONSE (if any) */}
      {clientResponse && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Client response
            </CardTitle>
            {clientResponse.submitted_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(clientResponse.submitted_at).toLocaleString()}
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {clientResponse.overall_message && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</div>
                <div className="mt-1 whitespace-pre-wrap rounded-md border bg-background p-3">
                  {clientResponse.overall_message}
                </div>
              </div>
            )}
            {clientResponse.selected_alternatives && Object.keys(clientResponse.selected_alternatives).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client picks</div>
                <ul className="mt-1 space-y-1">
                  {Object.entries(clientResponse.selected_alternatives).map(([gid, itemId]) => {
                    const g = altGroups.find((x) => x.id === gid);
                    return (
                      <li key={gid}>
                        <span className="text-muted-foreground">{g?.name ?? gid}:</span>{" "}
                        <span className="font-medium">{itemName(itemId)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {clientResponse.item_notes && Object.keys(clientResponse.item_notes).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item notes</div>
                <ul className="mt-1 space-y-1">
                  {Object.entries(clientResponse.item_notes).map(([itemId, note]) => (
                    <li key={itemId}>
                      <span className="text-muted-foreground">{itemName(itemId)}:</span>{" "}
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {clientResponse.computed_total != null && (
              <div className="text-xs text-muted-foreground">
                Client-computed total: {money(clientResponse.computed_total, currency)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PROPOSAL SECTION */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Proposal</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={previewAsClient}>
            <Eye className="mr-1 h-4 w-4" /> Preview as client
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Cover</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cover title</Label>
                <Input
                  value={coverTitle}
                  onChange={(e) => { setCoverTitle(e.target.value); setCoverTouched(true); }}
                  placeholder="e.g. Your winter wedding at Villa Rosa"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-generated from event type + date. Edit to override.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Intro message (Markdown supported)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={suggestIntroText}>
                    <Sparkles className="mr-1 h-3.5 w-3.5" /> Suggest text
                  </Button>
                </div>
                <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as any)}>
                  <TabsList className="mb-2">
                    <TabsTrigger value="write">Write</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="write">
                    <Textarea
                      rows={6}
                      value={introMarkdown}
                      onChange={(e) => setIntroMarkdown(e.target.value)}
                      placeholder={"Dear Alex,\n\nWe're delighted to share the following options for your event.\n\n**What's included:**\n- Space rental\n- Menu options to choose from"}
                    />
                  </TabsContent>
                  <TabsContent value="preview">
                    <div className="min-h-[8rem] rounded-md border p-3">
                      {introMarkdown ? <Markdown source={introMarkdown} /> : (
                        <div className="text-sm text-muted-foreground">Nothing to preview yet.</div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spaces</CardTitle>
              {deal.event_date && spaces.length > availableSpaces.length && (
                <p className="text-xs text-muted-foreground">
                  Showing spaces available on {formatEventDate(deal.event_date)} ({spaces.length - availableSpaces.length} hidden).
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {spaces.length === 0 && <EmptyHint to="/catalog/spaces" label="Add spaces in catalog" />}
              {availableSpaces.length === 0 && spaces.length > 0 && (
                <p className="text-sm text-muted-foreground">No spaces are configured for this weekday.</p>
              )}
              {availableSpaces.map((s) => (
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
            packageHours={packageHours}
            onHoursChange={setHoursOverride}
            defaultHours={categoryDefaultHours(fees as CategoryDefaults, "food")}
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
            packageHours={packageHours}
            onHoursChange={setHoursOverride}
            defaultHours={categoryDefaultHours(fees as CategoryDefaults, "beverage")}
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Options for the client to choose from</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setAltGroups((cur) => [
                    ...cur,
                    { id: newGroupId(), name: "New choice", category: "food", item_ids: [], default_id: "" },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add option group
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {altGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Give the client a choice, e.g. "Dinner: 3-course menu OR buffet". Add a group and pick two or more
                  items — the client picks exactly one.
                </p>
              )}
              {altGroups.map((g, idx) => {
                const items = itemsForCategory(g.category);
                return (
                  <div key={g.id} className="space-y-3 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="max-w-xs"
                        value={g.name}
                        onChange={(e) =>
                          setAltGroups((cur) => cur.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                        }
                        placeholder="Group name"
                      />
                      <Select
                        value={g.category}
                        onValueChange={(v) =>
                          setAltGroups((cur) =>
                            cur.map((x, i) =>
                              i === idx
                                ? { ...x, category: v as AlternativeGroup["category"], item_ids: [], default_id: "" }
                                : x,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="space">Space</SelectItem>
                          <SelectItem value="food">Food</SelectItem>
                          <SelectItem value="beverage">Beverage</SelectItem>
                          <SelectItem value="extra">Extra</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex-1" />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setAltGroups((cur) => cur.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Items in this group (client picks one)</Label>
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No items in this category yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {items.map((it) => {
                            const included = g.item_ids.includes(it.id);
                            return (
                              <label key={it.id} className="flex items-center gap-2 rounded border px-2 py-1 text-sm">
                                <Checkbox
                                  checked={included}
                                  onCheckedChange={(v) =>
                                    setAltGroups((cur) =>
                                      cur.map((x, i) => {
                                        if (i !== idx) return x;
                                        const next = v
                                          ? Array.from(new Set([...x.item_ids, it.id]))
                                          : x.item_ids.filter((y) => y !== it.id);
                                        return {
                                          ...x,
                                          item_ids: next,
                                          default_id: next.includes(x.default_id) ? x.default_id : next[0] ?? "",
                                        };
                                      }),
                                    )
                                  }
                                />
                                <span className="flex-1">{it.name}</span>
                                {included && (
                                  <button
                                    type="button"
                                    className={
                                      "text-[11px] " +
                                      (g.default_id === it.id
                                        ? "font-semibold text-primary"
                                        : "text-muted-foreground hover:text-foreground")
                                    }
                                    onClick={() =>
                                      setAltGroups((cur) =>
                                        cur.map((x, i) => (i === idx ? { ...x, default_id: it.id } : x)),
                                      )
                                    }
                                  >
                                    {g.default_id === it.id ? "Default" : "Set default"}
                                  </button>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Pricing rules</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <div className="font-medium text-foreground">
                  Minimum revenue {matchedRule ? "(auto-matched)" : "(no rule matched)"}
                </div>
                {matchedRule ? (
                  <div className="mt-1 space-y-1 text-muted-foreground">
                    <div>
                      {matchedRule.notes || "Rule"} · {money(Number(matchedRule.min_revenue), currency)} {matchedRule.basis}
                    </div>
                    {deal.event_date && (
                      <div>Applied for {formatEventDate(deal.event_date)}.</div>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-muted-foreground">
                    No minimum revenue rule matches this weekday/month. Set one in Catalog → Rules.
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground">Override</Label>
                  <Input
                    type="number"
                    className="h-7 w-32"
                    value={minRevenue}
                    onChange={(e) => setMinRevenue(Number(e.target.value))}
                  />
                </div>
              </div>

              {seasons.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Season multiplier</Label>
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
              )}

              {(() => {
                const gType = (fees as any)?.gratuity_type ?? "service_charge";
                const gMode = (fees as any)?.gratuity_mode ?? "slider";
                const gMin = Number((fees as any)?.gratuity_min_pct ?? 0);
                const gMax = Number((fees as any)?.gratuity_max_pct ?? 20);
                const gFixed = Number((fees as any)?.gratuity_fixed_pct ?? 0);
                const label = gType === "tip" ? "Tip" : "Service charge";
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{label}</Label>
                      <span className="text-sm font-medium tabular-nums">
                        {(gMode === "fixed" ? gFixed : servicePct).toFixed(1)}%
                      </span>
                    </div>
                    {gMode === "fixed" ? (
                      <div className="text-xs text-muted-foreground">
                        Fixed rate configured in Catalog → Pricing rules.
                      </div>
                    ) : (
                      <Slider
                        value={[Math.max(gMin, Math.min(gMax, servicePct))]}
                        min={gMin}
                        max={gMax}
                        step={0.5}
                        onValueChange={(v) => setServicePct(v[0] ?? gMin)}
                      />
                    )}
                    <div className="rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                      Calculated {label.toLowerCase()}:{" "}
                      <span className="tabular-nums font-medium text-foreground">
                        {money(totals.gratuity_gross, currency)}
                      </span>
                      {gType === "service_charge" && totals.gratuity_tax > 0 && (
                        <>
                          {" "}· incl. tax{" "}
                          <span className="tabular-nums font-medium text-foreground">
                            {money(totals.gratuity_tax, currency)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}


              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showDiscount}
                    onChange={(e) => setShowDiscount(e.target.checked)}
                  />
                  Apply a discount (optional)
                </label>
                {showDiscount && (
                  <div className="space-y-1.5">
                    <Label>Discount (gross)</Label>
                    <Input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="sticky top-4 border-2 border-primary/30 shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-background to-background">
            <CardHeader className="border-b bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-primary" />
                Event quote
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm pt-4">
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

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Net subtotal</span><span className="tabular-nums">{money(totals.net_subtotal, currency)}</span></div>
                <div className="flex justify-between"><span>Total tax</span><span className="tabular-nums">{money(totals.tax_subtotal, currency)}</span></div>
                <div className="flex justify-between"><span>Gross subtotal</span><span className="tabular-nums">{money(totals.gross_subtotal, currency)}</span></div>
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                {effectiveDiscount > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">-{money(effectiveDiscount, currency)}</span></div>
                )}
                <div className="flex justify-between"><span>{totals.gratuity_label}</span><span className="tabular-nums">{money(totals.gratuity_gross, currency)}</span></div>
              </div>

              <div className="mt-3 rounded-lg bg-primary text-primary-foreground p-4 flex items-baseline justify-between shadow-md">
                <span className="text-xs uppercase tracking-wider opacity-80">Grand total</span>
                <span className="text-2xl font-bold tabular-nums tracking-tight">{money(totals.grand_total, currency)}</span>
              </div>

              {totals.min_shortfall > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-2.5 text-xs text-yellow-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Net minimum not met</div>
                    <div>Shortfall of {money(totals.min_shortfall, currency)}.</div>
                  </div>
                </div>
              ) : minRevenue > 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Minimum revenue met</span>
                </div>
              ) : null}
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

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function EditDealDialog({
  open, onOpenChange, deal, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal: Deal;
  onSaved: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("deals")
      .update({
        client_name: fd.get("client_name") as string,
        client_email: fd.get("client_email") as string,
        client_company: (fd.get("client_company") as string) || null,
        event_type: (fd.get("event_type") as string) || null,
        event_date: (fd.get("event_date") as string) || null,
        guest_count: Number(fd.get("guest_count") || 0),
        notes: (fd.get("notes") as string) || null,
      })
      .eq("id", deal.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await supabase.from("deal_activities").insert({
      deal_id: deal.id,
      company_id: deal.company_id,
      kind: "deal_updated",
    });
    toast.success("Deal updated");
    onOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Edit deal</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <TextField name="client_name" label="Client name" defaultValue={deal.client_name} required />
            <TextField name="client_email" label="Client email" type="email" defaultValue={deal.client_email} required />
          </div>
          <TextField name="client_company" label="Client company" defaultValue={deal.client_company ?? ""} />
          <div className="grid grid-cols-3 gap-3">
            <TextField name="event_type" label="Event type" defaultValue={deal.event_type ?? ""} />
            <TextField name="event_date" label="Event date" type="date" defaultValue={deal.event_date ?? ""} />
            <TextField name="guest_count" label="Guests" type="number" defaultValue={String(deal.guest_count ?? 0)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={deal.notes ?? ""} />
          </div>
          <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextField(props: {
  name: string; label: string; type?: string; required?: boolean; defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input {...props} id={props.name} />
    </div>
  );
}

function PackageCard({
  title, emptyTo, items, currency, selected, onToggle, dealGuests, packageGuests, onGuestChange,
  packageHours, onHoursChange, defaultHours,
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
  packageHours: Record<string, number>;
  onHoursChange: (id: string, v: number) => void;
  defaultHours: number;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <EmptyHint to={emptyTo} label={`Add ${title.toLowerCase()} in catalog`} />}
        {items.map((p) => {
          const checked = selected.includes(p.id);
          const guests = packageGuests[p.id] ?? dealGuests;
          const standardHours = p.included_hours != null ? Number(p.included_hours) : defaultHours;
          const hours = packageHours[p.id] ?? standardHours;
          const overRate = Number(p.overage_price_per_person_per_hour ?? 0);
          return (
            <div key={p.id} className="rounded-md border p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={checked} onCheckedChange={(v) => onToggle(p.id, v)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {money(p.price_per_person, currency)} per guest · {standardHours}h included
                    {overRate > 0 && <> · +{money(overRate, currency)}/guest/h overtime</>}
                  </div>
                </div>
              </label>
              {checked && (
                <div className="mt-2 space-y-2 border-t pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-32 text-muted-foreground">Guests</span>
                    <Input
                      type="number"
                      min={1}
                      value={guests}
                      onChange={(e) => onGuestChange(p.id, Math.max(1, Number(e.target.value) || 1))}
                      className="h-7 w-20"
                    />
                    {guests !== dealGuests && (
                      <button type="button" className="text-primary underline"
                        onClick={() => onGuestChange(p.id, dealGuests)}>
                        reset to {dealGuests}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-32 text-muted-foreground">Event hours</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={hours}
                      onChange={(e) => onHoursChange(p.id, Math.max(0, Number(e.target.value) || 0))}
                      className="h-7 w-20"
                    />
                    <span className="text-muted-foreground">standard {standardHours}h</span>
                    {hours !== standardHours && (
                      <button type="button" className="text-primary underline"
                        onClick={() => onHoursChange(p.id, standardHours)}>
                        reset
                      </button>
                    )}
                  </div>
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
