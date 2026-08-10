import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { sendProposalReminder } from "@/lib/proposal-reminders.functions";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  type StaffSel,
  type DiscountTarget,
} from "@/lib/pricing";
import { categoryDefaultHours, type CategoryDefaults } from "@/lib/tax";
import { RichText } from "@/components/markdown";
import {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  CATEGORY_MODE_LABELS,
  DEFAULT_CATEGORY_MODES,
  DEFAULT_OFFER_ALTERNATIVES,
  categoryModeSummary,
  chargeableIds,
  isSingleChoice,
  resolveCategoryModes,
  resolveOfferAlternatives,
  resolvePrimaryIds,
  type CategoryKey,
  type CategoryMode,
} from "@/lib/selection-modes";
import { RichTextEditor } from "@/components/rich-text-editor";
import { MenuSelectionPicker, type MenuGroupDef } from "@/components/menu-selection-picker";
import { Slider } from "@/components/ui/slider";
import { randomToken } from "@/lib/auth-hooks";
import { toast } from "sonner";
import { ArrowLeft, Copy, Send, AlertTriangle, Eye, Pencil, Plus, Trash2, MessageSquare, Sparkles, Receipt, CheckCircle2, ShieldCheck, Clock, ChevronRight } from "lucide-react";
import { SEATING_STYLES } from "@/lib/seating";
import { stageLabel, HARD_CONFLICT_STAGES, SOFT_CONFLICT_STAGES } from "@/lib/deal-stages";
import { approvalLabel, approvalToneClass, type ApprovalStatus } from "@/lib/deal-approval";
import { formatEventDate, weekdayOf, pickMinRevRule, type MinRevRule } from "@/lib/date-format";
import { ContractsPanel } from "@/components/contracts-panel";
import { InvoicePanel } from "@/components/invoice-panel";
import { EventBriefPanel } from "@/components/event-brief-panel";
import { RequirePermission } from "@/components/permission-guard";



export const Route = createFileRoute("/_authenticated/deals_/$id")({
  component: () => (
    <RequirePermission module="deals">
      <DealDetail />
    </RequirePermission>
  ),
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
  approval_status: ApprovalStatus;
  approval_note: string | null;
  approval_requested_by: string | null;
  approved_by: string | null;
  custom_fields?: Record<string, { label?: string; value: unknown }> | null;
};


type Season = { id: string; name: string; multiplier: number };
type SpaceRow = SpaceSel & {
  available_days?: number[] | null;
  details_url?: string | null;
  capacity?: number | null;
  capacity_seated?: number | null;
  capacity_standing?: number | null;
  event_types?: string[] | null;
  size?: string | null;
  seating_capacities?: Record<string, number> | null;
};

/** Catalog fit helpers — same rules the auto-suggest uses (lead-suggest.server.ts). */
function spaceCapacity(s: any): number {
  return (
    Number(s?.capacity ?? 0) ||
    Number(s?.capacity_seated ?? 0) ||
    Number(s?.capacity_standing ?? 0) ||
    0
  );
}

function matchesEventType(tags: unknown, eventType: string | null | undefined): boolean {
  const list = Array.isArray(tags) ? (tags as string[]) : [];
  if (list.length === 0) return true;
  const needle = (eventType ?? "").trim().toLowerCase();
  if (!needle) return true;
  return list.some((t) => String(t).trim().toLowerCase() === needle);
}

function spaceFitsDeal(s: any, guests: number): boolean {
  if (!guests) return true;
  const cap = spaceCapacity(s);
  return cap === 0 || cap >= guests;
}

function packageFitsDeal(p: any, guests: number, eventType: string | null | undefined): boolean {
  if (!matchesEventType(p?.event_types, eventType)) return false;
  if (!guests) return true;
  const min = Number(p?.min_guests ?? 0) || 0;
  const max = p?.max_guests == null ? null : Number(p.max_guests);
  if (guests < min) return false;
  if (max != null && max > 0 && guests > max) return false;
  return true;
}

type AlternativeGroup = {
  id: string;
  name: string;
  category: "space" | "food" | "beverage" | "extra" | "staff";
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
  const [staff, setStaff] = useState<StaffSel[]>([]);
  const [fees, setFees] = useState<any>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [minRevRules, setMinRevRules] = useState<MinRevRule[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [showAllSpaces, setShowAllSpaces] = useState(false);
  const [showAllFood, setShowAllFood] = useState(false);
  const [showAllBeverages, setShowAllBeverages] = useState(false);

  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffConfig, setStaffConfig] = useState<Record<string, { count?: number; hours?: number }>>({});
  const [packageGuests, setPackageGuests] = useState<Record<string, number>>({});
  const [seatingStyle, setSeatingStyle] = useState<Record<string, string>>({});

  const [packageHours, setPackageHours] = useState<Record<string, number>>({});

  const [seasonId, setSeasonId] = useState<string>("none");
  const [discount, setDiscount] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountTarget, setDiscountTarget] = useState<DiscountTarget | null>(null);
  const [minRevenue, setMinRevenue] = useState(0);
  const [servicePct, setServicePct] = useState<number>(0);
  const [coverTitle, setCoverTitle] = useState("");
  const [coverTouched, setCoverTouched] = useState(false);
  const [introMarkdown, setIntroMarkdown] = useState("");
  const [altGroups, setAltGroups] = useState<AlternativeGroup[]>([]);
  // How the client interacts with each category on the proposal.
  const [categoryModes, setCategoryModes] = useState<Record<CategoryKey, CategoryMode>>(
    DEFAULT_CATEGORY_MODES,
  );
  // The proposed / recommended pick per single-choice category (charged + pre-selected).
  const [primaryIds, setPrimaryIds] = useState<Record<CategoryKey, string>>({
    space: "", food: "", beverage: "", extra: "", staff: "",
  });
  // Whether the client sees the other selected items as switchable alternatives.
  const [offerAlternatives, setOfferAlternatives] = useState<Record<CategoryKey, boolean>>(
    DEFAULT_OFFER_ALTERNATIVES,
  );
  const [companyRow, setCompanyRow] = useState<any>(null);


  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [menuModeByPkg, setMenuModeByPkg] = useState<Record<string, "manager" | "client">>({});
  const [menuChoicesByPkg, setMenuChoicesByPkg] = useState<Record<string, Record<string, string[]>>>({});

  const [activities, setActivities] = useState<any[]>([]);
  const [existingProposal, setExistingProposal] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [conflicts, setConflicts] = useState<
    { id: string; client_name: string; client_company: string | null; stage: string }[]
  >([]);
  const [requireApproval, setRequireApproval] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState<"external" | "template">("external");
  const [invoiceNotes, setInvoiceNotes] = useState<string | null>(null);
  const [reminderDays, setReminderDays] = useState<number>(5);
  const [userId, setUserId] = useState<string | null>(null);
  const [approvalNoteOpen, setApprovalNoteOpen] = useState(false);
  const [approvalNoteDraft, setApprovalNoteDraft] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);
  const [dealTab, setDealTab] = useState<"proposal" | "brief">("proposal");



  async function loadAll() {
    const { data: userData } = await supabase.auth.getUser();
    setUserId(userData.user?.id ?? null);
    const { data: d } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    if (!d) return;
    setDeal(d as Deal);

    const [sp, pk, ex, stf, fc, ss, mr, co, ac, pr] = await Promise.all([
      supabase.from("spaces").select("id, name, base_rental_fee, min_rental_fee, basis, tax_rate_pct, long_description, available_days, details_url, weekday_pricing, capacity, capacity_seated, capacity_standing, event_types, size, seating_capacities").eq("active", true),
      supabase.from("fb_packages").select("id, name, price_per_person, kind, basis, tax_rate_pct, long_description, min_guests, max_guests, event_types, included_hours, overage_price_per_person_per_hour, details_url, selection_mode, selection_groups, selection_total_max").eq("active", true),
      supabase.from("extras").select("id, name, pricing_type, price, basis, tax_rate_pct, long_description").eq("active", true),
      supabase.from("staff_roles").select("id, name, pricing_type, price, basis, tax_rate_pct, long_description").eq("active", true),
      supabase.from("fee_config").select("*").eq("company_id", d.company_id).maybeSingle(),
      supabase.from("pricing_seasons").select("id, name, multiplier"),
      supabase.from("pricing_rules").select("id, notes, days_of_week, months, space_ids, min_revenue, basis").eq("company_id", d.company_id),
      supabase.from("companies").select("currency, require_deal_approval, invoice_mode, invoice_notes, proposal_reminder_days, client_select_space, client_select_food, client_select_beverage").eq("id", d.company_id).maybeSingle(),
      supabase.from("deal_activities").select("*").eq("deal_id", id).order("created_at", { ascending: false }),

      supabase.from("proposals").select("*").eq("deal_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSpaces((sp.data as SpaceRow[]) ?? []);
    setPackages((pk.data as PackageSel[]) ?? []);
    setExtras((ex.data as ExtraSel[]) ?? []);
    setStaff((stf.data as StaffSel[]) ?? []);
    const feeRow: any = fc.data ?? {
      service_charge_pct: 0, tax_pct: 0, cleaning_fee: 0, overtime_fee_per_hour: 0,
    };
    setFees(feeRow);
    setSeasons((ss.data as Season[]) ?? []);
    const rules = (mr.data as MinRevRule[]) ?? [];
    setMinRevRules(rules);
    if (co.data?.currency) setCurrency(co.data.currency);
    setRequireApproval(!!(co.data as any)?.require_deal_approval);
    setInvoiceMode(((co.data as any)?.invoice_mode as "external" | "template") ?? "external");
    setInvoiceNotes(((co.data as any)?.invoice_notes as string) ?? null);
    setReminderDays(Number((co.data as any)?.proposal_reminder_days ?? 5));
    setCompanyRow(co.data ?? null);
    setCategoryModes(resolveCategoryModes((pr.data?.offer as any) ?? {}, co.data));


    setActivities(ac.data ?? []);
    if (pr.data) {
      setExistingProposal(pr.data);
      const cfg = (pr.data.offer as any) ?? {};
      const cons = (pr.data.constraints as any) ?? {};
      setSelectedSpaces(cfg.space_ids ?? []);
      setSelectedPackages(cfg.package_ids ?? []);
      setSelectedExtras(cfg.extra_ids ?? []);
      setSelectedStaff(cfg.staff_ids ?? []);
      setStaffConfig(cfg.staff_config ?? {});
      setPackageGuests(cfg.package_guests ?? {});
      setSeatingStyle((cfg.seating_style as Record<string, string>) ?? {});

      setPackageHours(cfg.package_hours ?? {});
      setSeasonId(cfg.season_id ?? "none");
      const savedDiscount = Number(cfg.discount ?? 0);
      setDiscount(savedDiscount);
      setShowDiscount(savedDiscount > 0);
      setDiscountTarget((cfg.discount_target as DiscountTarget | null) ?? null);
      setCoverTitle(cfg.cover_title ?? "");
      setCoverTouched(!!cfg.cover_title);
      setAltGroups(cfg.alternative_groups ?? []);
      const loadedModes = resolveCategoryModes(cfg, co.data);
      setCategoryModes(loadedModes);
      setOfferAlternatives(resolveOfferAlternatives(cfg));
      {
        const pkgList = ((pk.data as PackageSel[]) ?? []);
        const selPkgs: string[] = cfg.package_ids ?? [];
        const byCat: Record<CategoryKey, string[]> = {
          space: cfg.space_ids ?? [],
          food: selPkgs.filter((pid) => (pkgList.find((p) => p.id === pid)?.kind ?? "food") === "food"),
          beverage: selPkgs.filter((pid) => pkgList.find((p) => p.id === pid)?.kind === "beverage"),
          extra: cfg.extra_ids ?? [],
          staff: cfg.staff_ids ?? [],
        };
        setPrimaryIds(resolvePrimaryIds(cfg, loadedModes, byCat));
      }


      setMenuModeByPkg((cfg.menu_selection_mode_by_pkg as any) ?? {});
      setMenuChoicesByPkg((cfg.menu_choices_by_pkg as any) ?? {});
      setIntroMarkdown(cons.intro_markdown ?? cons.client_message ?? "");
      const savedService = cfg.service_charge_pct_override;
      const gratDefault =
        feeRow?.gratuity_mode === "fixed"
          ? Number(feeRow?.gratuity_fixed_pct ?? 0)
          : Number(feeRow?.gratuity_default_pct ?? feeRow?.service_charge_pct ?? 0);
      setServicePct(typeof savedService === "number" ? savedService : gratDefault);
      // Prefer saved min-revenue if it was set explicitly, otherwise recompute from rules.
      const savedMin = Number(cfg.min_revenue_required ?? 0);
      const matched = pickMinRevRule(rules, d.event_date, cfg.space_ids ?? []);
      setMinRevenue(savedMin || Number(matched?.min_revenue ?? 0));
    } else {
      const gratDefault =
        feeRow?.gratuity_mode === "fixed"
          ? Number(feeRow?.gratuity_fixed_pct ?? 0)
          : Number(feeRow?.gratuity_default_pct ?? feeRow?.service_charge_pct ?? 0);
      setServicePct(gratDefault);
      const matched = pickMinRevRule(rules, d.event_date, []);
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

  // Fetch other deals on the same event date within the same company.
  useEffect(() => {
    if (!deal?.event_date || !deal?.company_id) {
      setConflicts([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, client_name, client_company, stage")
        .eq("company_id", deal.company_id)
        .eq("event_date", deal.event_date!)
        .neq("id", deal.id);
      setConflicts(((data as any[]) ?? []).filter((d) => d.stage !== "lost"));
    })();
  }, [deal?.id, deal?.event_date, deal?.company_id]);



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
    () => pickMinRevRule(minRevRules, deal?.event_date, selectedSpaces),
    [minRevRules, deal?.event_date, selectedSpaces],
  );

  // Filter spaces by day-of-week availability when the deal has an event date.
  const availableSpaces = useMemo(() => {
    const wd = weekdayOf(deal?.event_date);
    if (wd == null) return spaces;
    return spaces.filter((s) => !s.available_days || s.available_days.length === 0 || s.available_days.includes(wd));
  }, [spaces, deal?.event_date]);

  // What the manager selected, split per category (alt-group items excluded elsewhere).
  const selectedByCategory = useMemo<Record<CategoryKey, string[]>>(() => {
    const kindOf = (pid: string) => packages.find((p) => p.id === pid)?.kind ?? "food";
    return {
      space: selectedSpaces,
      food: selectedPackages.filter((pid) => kindOf(pid) === "food"),
      beverage: selectedPackages.filter((pid) => kindOf(pid) === "beverage"),
      extra: selectedExtras,
      staff: selectedStaff,
    };
  }, [packages, selectedSpaces, selectedPackages, selectedExtras, selectedStaff]);

  // Keep the proposed pick valid: default to the first selected item in
  // single-choice categories, clear it everywhere else.
  useEffect(() => {
    setPrimaryIds((cur) => {
      let changed = false;
      const next = { ...cur };
      for (const cat of CATEGORY_KEYS) {
        const ids = selectedByCategory[cat];
        const want = isSingleChoice(categoryModes[cat])
          ? (cur[cat] && ids.includes(cur[cat]) ? cur[cat] : (ids[0] ?? ""))
          : "";
        if (want !== cur[cat]) {
          next[cat] = want;
          changed = true;
        }
      }
      return changed ? next : cur;
    });
  }, [selectedByCategory, categoryModes]);

  // Items shown to the client but not charged.
  const alternativesByCategory = useMemo<Record<CategoryKey, string[]>>(() => {
    const out = {} as Record<CategoryKey, string[]>;
    for (const cat of CATEGORY_KEYS) {
      const charged = chargeableIds(categoryModes[cat], primaryIds[cat], selectedByCategory[cat]);
      out[cat] = selectedByCategory[cat].filter((id) => !charged.includes(id));
    }
    return out;
  }, [selectedByCategory, categoryModes, primaryIds]);

  // For the manager's own totals preview, resolve each alt group to its default choice.

  const resolvedSelection = useMemo(() => {
    const extraSpaces: string[] = [];
    const extraPkgs: string[] = [];
    const extraExtras: string[] = [];
    const extraStaff: string[] = [];
    for (const g of altGroups) {
      const target = g.default_id && g.item_ids.includes(g.default_id) ? g.default_id : g.item_ids[0];
      if (!target) continue;
      if (g.category === "space") extraSpaces.push(target);
      else if (g.category === "extra") extraExtras.push(target);
      else if (g.category === "staff") extraStaff.push(target);
      else extraPkgs.push(target);
    }
    // Only chargeable items count: the proposed pick in single-choice categories,
    // everything selected in multiple/fixed ones. Alternatives are never summed.
    const charged = (cat: CategoryKey) =>
      chargeableIds(categoryModes[cat], primaryIds[cat], selectedByCategory[cat]);
    return {
      guest_count: deal?.guest_count ?? 0,
      space_ids: Array.from(new Set([...charged("space"), ...extraSpaces])),
      package_ids: Array.from(new Set([...charged("food"), ...charged("beverage"), ...extraPkgs])),
      extra_ids: Array.from(new Set([...charged("extra"), ...extraExtras])),
      staff_ids: Array.from(new Set([...charged("staff"), ...extraStaff])),
      staff_config: staffConfig,
      package_guests: packageGuests,
      package_hours: packageHours,
      event_date: deal?.event_date ?? null,
    } as Selection;
  }, [deal, selectedByCategory, categoryModes, primaryIds, staffConfig, packageGuests, packageHours, altGroups]);


  const effectiveDiscount = showDiscount ? discount : 0;

  const effectiveDiscountTarget = showDiscount ? discountTarget : null;

  const offer: Offer | null = useMemo(() => {
    if (!fees) return null;
    return {
      spaces, packages, extras, staff,
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
      discount_target: effectiveDiscountTarget,
      currency,
    };
  }, [spaces, packages, extras, staff, fees, seasonMult, effectiveDiscount, effectiveDiscountTarget, minRevenue, servicePct, currency]);


  const totals = offer ? computeTotals(offer, resolvedSelection) : null;

  const allFoodPackages = packages.filter((p) => (p.kind ?? "food") === "food");
  const allBeveragePackages = packages.filter((p) => p.kind === "beverage");
  const dealGuestCount = Number(deal?.guest_count ?? 0) || 0;
  const dealEventType = deal?.event_type ?? null;
  const keepFittingSpaces = (list: SpaceRow[]) =>
    list.filter((s) => selectedSpaces.includes(s.id) || spaceFitsDeal(s, dealGuestCount));
  const keepFittingPkgs = (list: PackageSel[]) =>
    list.filter(
      (p) => selectedPackages.includes(p.id) || packageFitsDeal(p, dealGuestCount, dealEventType),
    );
  const fittingSpaces = keepFittingSpaces(availableSpaces);
  const shownSpaces = showAllSpaces ? availableSpaces : fittingSpaces;
  const fittingFood = keepFittingPkgs(allFoodPackages);
  const fittingBeverages = keepFittingPkgs(allBeveragePackages);
  const foodPackages = showAllFood ? allFoodPackages : fittingFood;
  const beveragePackages = showAllBeverages ? allBeveragePackages : fittingBeverages;
  const itemsForCategory = (cat: AlternativeGroup["category"]) => {
    if (cat === "space") return availableSpaces.map((s) => ({ id: s.id, name: s.name }));
    if (cat === "food") return foodPackages.map((p) => ({ id: p.id, name: p.name }));
    if (cat === "beverage") return beveragePackages.map((p) => ({ id: p.id, name: p.name }));
    if (cat === "staff") return staff.map((x) => ({ id: x.id, name: x.name }));
    return extras.map((e) => ({ id: e.id, name: e.name }));
  };

  // Candidate lines (by sourceKind+sourceId) that the discount can be applied to.
  const discountTargets = (totals?.lines ?? [])
    .filter((l) => l.sourceKind === "space" || l.sourceKind === "package" || l.sourceKind === "extra" || l.sourceKind === "staff")
    .map((l) => ({
      kind: l.sourceKind as DiscountTarget["kind"],
      id: l.sourceId!,
      label: l.label,
      gross: (l.original_gross ?? l.gross),
    }));

  function buildOfferConfig() {
    return {
      space_ids: selectedSpaces,
      package_ids: selectedPackages,
      extra_ids: selectedExtras,
      staff_ids: selectedStaff,
      staff_config: staffConfig,
      package_guests: packageGuests,
      package_hours: packageHours,
      season_id: seasonId,
      discount: effectiveDiscount,
      discount_target: effectiveDiscountTarget,
      min_revenue_required: minRevenue,
      service_charge_pct_override: servicePct,
      guest_count: deal?.guest_count ?? 0,
      cover_title: coverTitle,
      alternative_groups: altGroups,
      category_modes: categoryModes,
      primary_ids: primaryIds,
      offer_alternatives: offerAlternatives,

      seating_style: Object.fromEntries(
        Object.entries(seatingStyle).filter(([id, v]) => v && selectedSpaces.includes(id)),
      ),


      menu_selection_mode_by_pkg: menuModeByPkg,
      menu_choices_by_pkg: menuChoicesByPkg,
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
    const staffNames = staff.filter((x) => selectedStaff.includes(x.id)).map((x) => x.name);
    if (staffNames.length) lines.push(`**Staffing:** ${staffNames.join(", ")}.`);
    if (altGroups.length) lines.push(`We've included a few **choices** below so you can shape the experience yourself.`);
    lines.push("");
    lines.push("Let me know what you think, or reply directly with any tweaks.");
    const html = lines
      .filter((l) => l.trim() !== "")
      .map((l) => `<p>${l.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`)
      .join("");
    setIntroMarkdown(html);
    toast.success("Suggested text inserted");
  }

  async function saveProposal(send: boolean): Promise<{ id: string; version: number } | null> {
    if (!deal || !totals) return null;
    if (send && requireApproval && deal.approval_status !== "approved") {
      toast.error("This deal needs internal approval before it can be sent to the client.");
      return null;
    }
    const version = existingProposal ? existingProposal.version + 1 : 1;
    const status = send ? "sent" : "draft";

    // Quote number: assigned on first send; later re-sends reuse the base with -vN.
    let quoteNumber: string | null = null;
    if (send) {
      const { data: prior } = await supabase
        .from("proposals")
        .select("quote_number")
        .eq("deal_id", deal.id)
        .not("quote_number", "is", null)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const priorNumber = (prior as any)?.quote_number as string | undefined;
      if (priorNumber) {
        const m = priorNumber.match(/^(.*?)-v(\d+)$/);
        const base = m ? m[1] : priorNumber;
        const nextRev = m ? Number(m[2]) + 1 : 2;
        quoteNumber = `${base}-v${nextRev}`;
      } else {
        const { data: generated, error: qErr } = await supabase.rpc("next_quote_number", {
          _company_id: deal.company_id,
        });
        if (qErr) { toast.error(qErr.message); return null; }
        quoteNumber = generated as unknown as string;
      }
    }
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
        quote_number: quoteNumber,
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
      // Saving a new draft invalidates any prior approval so it must be re-reviewed.
      const patch: any = { stage: "proposal_draft" };
      if (requireApproval && deal.approval_status === "approved") {
        patch.approval_status = "not_required";
        patch.approved_by = null;
        patch.approved_at = null;
      }
      await supabase.from("deals").update(patch).eq("id", deal.id);
      toast.success(`Draft v${version} saved`);
    }
    await loadAll();
    return { id: newProp.id, version };
  }

  async function sendForApproval() {
    if (!deal) return;
    // Persist current draft first so the approver sees the latest content.
    const saved = await saveProposal(false);
    if (!saved) return;
    const { error } = await supabase
      .from("deals")
      .update({
        approval_status: "pending",
        approval_requested_by: userId,
        approval_requested_at: new Date().toISOString(),
        approval_note: null,
        approved_by: null,
        approved_at: null,
      })
      .eq("id", deal.id);
    if (error) return toast.error(error.message);
    await supabase.from("deal_activities").insert({
      deal_id: deal.id, company_id: deal.company_id, actor_id: userId,
      kind: "approval_requested",
    });
    toast.success("Sent for approval");
    await loadAll();
  }

  async function approveDeal() {
    if (!deal) return;
    const { error } = await supabase
      .from("deals")
      .update({
        approval_status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approval_note: null,
      })
      .eq("id", deal.id);
    if (error) return toast.error(error.message);
    await supabase.from("deal_activities").insert({
      deal_id: deal.id, company_id: deal.company_id, actor_id: userId,
      kind: "approval_granted",
    });
    toast.success("Deal approved");
    await loadAll();
  }

  async function requestChanges() {
    if (!deal) return;
    const { error } = await supabase
      .from("deals")
      .update({
        approval_status: "changes_requested",
        approval_note: approvalNoteDraft || null,
        approved_by: null,
        approved_at: null,
      })
      .eq("id", deal.id);
    if (error) return toast.error(error.message);
    await supabase.from("deal_activities").insert({
      deal_id: deal.id, company_id: deal.company_id, actor_id: userId,
      kind: "approval_changes_requested", meta: { note: approvalNoteDraft || null },
    });
    setApprovalNoteOpen(false);
    setApprovalNoteDraft("");
    toast.success("Changes requested");
    await loadAll();
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

  const sendReminderFn = useServerFn(sendProposalReminder);

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
        action?: "confirmed" | "changes_requested" | "declined";
        note?: string | null;
      }
    | undefined;
  const clientAction = clientResponse?.action ?? (clientResponse ? "confirmed" : undefined);

  // ---- Stale-proposal reminder ----
  const proposalSentAt = existingProposal?.sent_at as string | null | undefined;
  const daysSinceSent = proposalSentAt
    ? Math.floor((Date.now() - new Date(proposalSentAt).getTime()) / 86_400_000)
    : 0;
  const lastReminderActivity = activities.find((a) => a.kind === "proposal_reminder_sent");
  const lastReminderAt = lastReminderActivity?.created_at as string | undefined;
  const hoursSinceLastReminder = lastReminderAt
    ? (Date.now() - new Date(lastReminderAt).getTime()) / 3_600_000
    : Infinity;
  const cooldownActive = hoursSinceLastReminder < 24;
  const showReminderBanner =
    !!proposalSentAt && !clientAction && daysSinceSent > reminderDays;

  async function handleSendReminder() {
    if (!deal) return;
    setSendingReminder(true);
    try {
      await sendReminderFn({ data: { dealId: deal.id } });
      toast.success("Reminder sent to client");
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send reminder");
    } finally {
      setSendingReminder(false);
    }
  }


  const itemName = (itemId: string) => {
    const s = spaces.find((x) => x.id === itemId);
    if (s) return s.name;
    const p = packages.find((x) => x.id === itemId);
    if (p) return p.name;
    const e = extras.find((x) => x.id === itemId);
    if (e) return e.name;
    const st = staff.find((x) => x.id === itemId);
    if (st) return st.name;
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
            {requireApproval && (
              <Badge className={"self-center border " + approvalToneClass(deal.approval_status)}>
                {approvalLabel(deal.approval_status)}
              </Badge>
            )}
          </div>
        }
      />


      <EditDealDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        deal={deal}
        onSaved={loadAll}
      />

      <Dialog open={approvalNoteOpen} onOpenChange={setApprovalNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="approval-note">Note for the deal owner</Label>
            <Textarea
              id="approval-note"
              rows={4}
              value={approvalNoteDraft}
              onChange={(e) => setApprovalNoteDraft(e.target.value)}
              placeholder="What should be adjusted before this goes to the client?"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApprovalNoteOpen(false)}>Cancel</Button>
              <Button onClick={requestChanges}>Send back for changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* CONFLICT BANNER */}
      {conflicts.length > 0 && (() => {
        const hard = conflicts.filter((c) => (HARD_CONFLICT_STAGES as string[]).includes(c.stage));
        const soft = conflicts.filter((c) => (SOFT_CONFLICT_STAGES as string[]).includes(c.stage));
        if (hard.length === 0 && soft.length === 0) return null;
        const isHard = hard.length > 0;
        const list = isHard ? hard : soft;
        return (
          <div
            className={
              "mb-4 flex items-start gap-3 rounded-md border px-3 py-2 text-sm " +
              (isHard
                ? "border-red-300 bg-red-50 text-red-900"
                : "border-orange-300 bg-orange-50 text-orange-900")
            }
          >
            <span
              className={
                "mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold " +
                (isHard ? "bg-red-600 text-white" : "bg-orange-500 text-white")
              }
              aria-hidden="true"
            >
              {isHard ? "!" : "▲"}
            </span>
            <div className="flex-1">
              <div className="font-medium">
                {isHard
                  ? `Conflict: ${hard.length} booked event${hard.length > 1 ? "s" : ""} on this date`
                  : `Warning: ${soft.length} deal${soft.length > 1 ? "s" : ""} in negotiation for this date`}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {list.map((c) => (
                  <Link
                    key={c.id}
                    to="/deals/$id"
                    params={{ id: c.id }}
                    className="underline underline-offset-2 hover:opacity-80"
                  >
                    {c.client_company ? `${c.client_company} · ${c.client_name}` : c.client_name}
                    <span className="opacity-70"> ({stageLabel(c.stage)})</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {existingProposal?.status === "draft" &&
        !existingProposal?.sent_at &&
        (existingProposal?.constraints as any)?.autodrafted && (
          <div className="mb-4 flex flex-wrap items-start gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium">Suggested draft from lead — review &amp; adjust</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                We pre-filled a space and packages from this lead. Nothing has been sent to the client yet.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                document.getElementById("proposal-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              Review draft
            </Button>
          </div>
        )}

      {showReminderBanner && (
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Clock className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="font-medium">
              Proposal sent {daysSinceSent} day{daysSinceSent === 1 ? "" : "s"} ago — no reply yet.
            </div>
            {lastReminderAt && (
              <div className="mt-0.5 text-xs">
                Last reminded on {new Date(lastReminderAt).toLocaleString()}.
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendReminder}
            disabled={sendingReminder || cooldownActive}
            title={cooldownActive ? "You already reminded the client in the last 24 hours." : undefined}
          >
            <Send className="mr-1 h-4 w-4" />
            {sendingReminder ? "Sending…" : "Send reminder to client"}
          </Button>
        </div>
      )}

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
          {deal.custom_fields && Object.keys(deal.custom_fields).length > 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Additional info</div>
              <dl className="mt-1 grid gap-2 sm:grid-cols-2">
                {Object.entries(deal.custom_fields).map(([k, entry]) => {
                  const label = (entry && typeof entry === "object" && "label" in entry && entry.label) || k;
                  const raw = entry && typeof entry === "object" && "value" in entry ? entry.value : entry;
                  const display =
                    raw === true ? "Yes" : raw === false ? "No" : raw == null || raw === "" ? "—" : String(raw);
                  return (
                    <div key={k} className="text-sm">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="whitespace-pre-wrap">{display}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CLIENT RESPONSE (if any) */}
      {clientResponse && (
        <Card
          className={
            "mb-6 " +
            (clientAction === "changes_requested"
              ? "border-amber-200 bg-amber-50/40"
              : clientAction === "declined"
              ? "border-red-200 bg-red-50/40"
              : "border-emerald-200 bg-emerald-50/40")
          }
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Client response
              </CardTitle>
              <div>
                <Badge
                  className={
                    "border " +
                    (clientAction === "changes_requested"
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : clientAction === "declined"
                      ? "bg-red-100 text-red-800 border-red-200"
                      : "bg-emerald-100 text-emerald-800 border-emerald-200")
                  }
                >
                  {clientAction === "changes_requested"
                    ? "Changes requested"
                    : clientAction === "declined"
                    ? "Declined"
                    : "Confirmed"}
                </Badge>
              </div>
            </div>
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
            {clientResponse.note && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {clientAction === "declined" ? "Reason" : "Requested changes"}
                </div>
                <div className="mt-1 whitespace-pre-wrap rounded-md border bg-background p-3">
                  {clientResponse.note}
                </div>
              </div>
            )}
            {clientAction === "changes_requested" && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => {
                    document.getElementById("proposal-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    toast.info("Edit the proposal below and click \"Send to client\" to deliver a new version.");
                  }}
                >
                  <Pencil className="mr-1 h-4 w-4" /> Edit &amp; send new version
                </Button>
              </div>
            )}
            {clientAction === "confirmed" && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => {
                    document.getElementById("contracts-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <Send className="mr-1 h-4 w-4" /> Create contract
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex gap-1 border-b">
        {(["proposal", "brief"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDealTab(t)}
            className={`border-b-2 px-3 py-2 text-sm capitalize ${
              dealTab === t
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {dealTab === "proposal" && (
      <div>
      {/* PROPOSAL SECTION */}
      <div id="proposal-section" className="mb-3 flex items-center justify-between scroll-mt-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Proposal</h2>
          {existingProposal?.quote_number && (
            <span className="rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {existingProposal.quote_number}
            </span>
          )}
        </div>
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
                  <Label>Intro message</Label>
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
                    <RichTextEditor
                      value={introMarkdown}
                      onChange={setIntroMarkdown}
                      toolbar="basic"
                      minHeight={180}
                      placeholder={"Dear Alex, we're delighted to share the following options for your event."}
                    />
                  </TabsContent>
                  <TabsContent value="preview">
                    <div className="min-h-[8rem] rounded-md border p-3">
                      {introMarkdown ? <RichText source={introMarkdown} /> : (
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
              <CardTitle>Selection rules</CardTitle>
              <p className="text-xs text-muted-foreground">
                How the client interacts with each category on the proposal. Defaults come from Settings.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {CATEGORY_KEYS.map((cat) => {
                const single = isSingleChoice(categoryModes[cat]);
                const altCount = alternativesByCategory[cat]?.length ?? 0;
                const chargedCount =
                  selectedByCategory[cat].length - altCount;
                return (
                  <div key={cat} className="space-y-1 rounded-md border p-3">
                    <p className="text-sm font-medium">{CATEGORY_LABELS[cat]}</p>
                    <Select
                      value={categoryModes[cat]}
                      onValueChange={(v) =>
                        setCategoryModes((cur) => ({ ...cur, [cat]: v as CategoryMode }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CATEGORY_MODE_LABELS) as CategoryMode[]).map((m) => (
                          <SelectItem key={m} value={m}>{CATEGORY_MODE_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {categoryModeSummary(cat, categoryModes[cat])}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs">Offer alternatives to client</span>
                      <Switch
                        checked={single ? offerAlternatives[cat] : false}
                        disabled={!single}
                        onCheckedChange={(v) =>
                          setOfferAlternatives((cur) => ({ ...cur, [cat]: v }))
                        }
                      />
                    </div>
                    {single && selectedByCategory[cat].length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {chargedCount} proposed + {altCount} alternative{altCount === 1 ? "" : "s"}
                        {altCount > 0 && !offerAlternatives[cat] ? " (hidden from client)" : ""}
                      </p>
                    )}
                  </div>
                );
              })}
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
              {availableSpaces.length > fittingSpaces.length && (
                <button
                  type="button"
                  className="w-fit text-xs text-primary underline"
                  onClick={() => setShowAllSpaces((v) => !v)}
                >
                  {showAllSpaces
                    ? `Show only spaces that fit ${dealGuestCount} guests`
                    : `Show all spaces (${availableSpaces.length - fittingSpaces.length} don't fit ${dealGuestCount} guests)`}
                </button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {spaces.length === 0 && <EmptyHint to="/catalog/spaces" label="Add spaces in catalog" />}
              {availableSpaces.length === 0 && spaces.length > 0 && (
                <p className="text-sm text-muted-foreground">No spaces are configured for this weekday.</p>
              )}
              {shownSpaces.length === 0 && availableSpaces.length > 0 && (
                <p className="text-sm text-muted-foreground">No spaces fit this guest count.</p>
              )}
              {shownSpaces.map((s) => (
                <div key={s.id} className="space-y-2">
                  <PickRow
                    checked={selectedSpaces.includes(s.id)}
                    onChange={(v) => toggle(setSelectedSpaces, s.id, v)}
                    title={s.name}
                    subtitle={`Base ${money(s.base_rental_fee, currency)} · min ${money(s.min_rental_fee, currency)}`}
                    link={s.details_url ? { href: s.details_url } : null}
                  />
                  {selectedSpaces.includes(s.id) && (
                    <SeatingSection
                      size={s.size ?? null}
                      capacities={(s.seating_capacities as Record<string, number> | null) ?? null}
                      value={seatingStyle[s.id] ?? ""}
                      onChange={(v) => setSeatingStyle((prev) => ({ ...prev, [s.id]: v }))}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <PackageCard
            title="Food packages"
            emptyTo="/catalog/food"
            items={foodPackages}
            hiddenCount={allFoodPackages.length - fittingFood.length}
            showAll={showAllFood}
            onShowAllChange={setShowAllFood}
            fitLabel={`this deal (${dealGuestCount} guests${dealEventType ? `, ${dealEventType}` : ""})`}
            currency={currency}
            selected={selectedPackages}
            onToggle={(id, v) => toggle(setSelectedPackages, id, v)}
            dealGuests={deal.guest_count}
            packageGuests={packageGuests}
            onGuestChange={setGuestOverride}
            packageHours={packageHours}
            onHoursChange={setHoursOverride}
            defaultHours={categoryDefaultHours(fees as CategoryDefaults, "food")}
            menuModeByPkg={menuModeByPkg}
            onMenuModeChange={(pid, mode) => setMenuModeByPkg((c) => ({ ...c, [pid]: mode }))}
            menuChoicesByPkg={menuChoicesByPkg}
            onMenuChoiceChange={(pid, gl, next) =>
              setMenuChoicesByPkg((c) => ({ ...c, [pid]: { ...(c[pid] ?? {}), [gl]: next } }))
            }
          />
          <PackageCard
            title="Beverage packages"
            emptyTo="/catalog/beverages"
            items={beveragePackages}
            hiddenCount={allBeveragePackages.length - fittingBeverages.length}
            showAll={showAllBeverages}
            onShowAllChange={setShowAllBeverages}
            fitLabel={`this deal (${dealGuestCount} guests${dealEventType ? `, ${dealEventType}` : ""})`}
            currency={currency}
            selected={selectedPackages}
            onToggle={(id, v) => toggle(setSelectedPackages, id, v)}
            dealGuests={deal.guest_count}
            packageGuests={packageGuests}
            onGuestChange={setGuestOverride}
            packageHours={packageHours}
            onHoursChange={setHoursOverride}
            defaultHours={categoryDefaultHours(fees as CategoryDefaults, "beverage")}
            menuModeByPkg={menuModeByPkg}
            onMenuModeChange={(pid, mode) => setMenuModeByPkg((c) => ({ ...c, [pid]: mode }))}
            menuChoicesByPkg={menuChoicesByPkg}
            onMenuChoiceChange={(pid, gl, next) =>
              setMenuChoicesByPkg((c) => ({ ...c, [pid]: { ...(c[pid] ?? {}), [gl]: next } }))
            }
          />


          <Card>
            <CardHeader><CardTitle>Extras</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {extras.length === 0 && <EmptyHint to="/catalog/extras" label="Add extras in catalog" />}
              {extras.map((e) => (
                <div key={e.id} className="space-y-2">
                  <PickRow
                    checked={selectedExtras.includes(e.id)}
                    onChange={(v) => toggle(setSelectedExtras, e.id, v)}
                    title={e.name}
                    subtitle={`${money(e.price, currency)} · ${e.pricing_type.replace("_", " ")}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Staffing</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {staff.length === 0 && <EmptyHint to="/catalog/staff" label="Add staff roles in catalog" />}
              {staff.map((x) => (
                <div key={x.id} className="space-y-2">
                  <PickRow
                    checked={selectedStaff.includes(x.id)}
                    onChange={(v) => toggle(setSelectedStaff, x.id, v)}
                    title={x.name}
                    subtitle={`${money(x.price, currency)} · ${x.pricing_type.replace("_", " ")}`}
                  />
                  {selectedStaff.includes(x.id) && x.pricing_type !== "per_person" && (
                    <div className="flex flex-wrap items-center gap-3 pl-9 text-xs text-muted-foreground">
                      <label className="flex items-center gap-2">
                        Count
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-20"
                          value={staffConfig[x.id]?.count ?? 1}
                          onChange={(e) =>
                            setStaffConfig((c) => ({
                              ...c,
                              [x.id]: { ...(c[x.id] ?? {}), count: Math.max(1, Number(e.target.value) || 1) },
                            }))
                          }
                        />
                      </label>
                      {x.pricing_type === "per_hour" && (
                        <label className="flex items-center gap-2">
                          Hours
                          <Input
                            type="number"
                            min={0}
                            step="0.5"
                            className="h-8 w-20"
                            value={staffConfig[x.id]?.hours ?? 1}
                            onChange={(e) =>
                              setStaffConfig((c) => ({
                                ...c,
                                [x.id]: { ...(c[x.id] ?? {}), hours: Math.max(0, Number(e.target.value) || 0) },
                              }))
                            }
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
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
                          <SelectItem value="staff">Staff</SelectItem>
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
                    onChange={(e) => {
                      setShowDiscount(e.target.checked);
                      if (e.target.checked && !discountTarget && discountTargets.length > 0) {
                        setDiscountTarget({ kind: discountTargets[0].kind, id: discountTargets[0].id });
                      }
                    }}
                  />
                  Apply a discount (optional)
                </label>
                {showDiscount && (
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Apply discount to</Label>
                      <Select
                        value={discountTarget ? `${discountTarget.kind}:${discountTarget.id}` : ""}
                        onValueChange={(v) => {
                          const [kind, id] = v.split(":") as [DiscountTarget["kind"], string];
                          setDiscountTarget({ kind, id });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Choose a line…" /></SelectTrigger>
                        <SelectContent>
                          {discountTargets.length === 0 && (
                            <div className="px-2 py-1 text-xs text-muted-foreground">Select a space, package, or extra first.</div>
                          )}
                          {discountTargets.map((t) => (
                            <SelectItem key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>
                              {t.label} — {money(t.gross, currency)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Discount amount (gross)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={discount}
                        onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                      />
                      {discountTarget && (() => {
                        const t = discountTargets.find((x) => x.kind === discountTarget.kind && x.id === discountTarget.id);
                        if (!t) return null;
                        const over = discount > t.gross;
                        return (
                          <p className={"text-xs " + (over ? "text-red-600" : "text-muted-foreground")}>
                            Line gross: {money(t.gross, currency)}
                            {over && <> — capped at line amount.</>}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          <Card className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col border-2 border-primary/30 shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-background to-background">
            <CardHeader className="border-b bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-primary" />
                Event quote
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-3 text-sm pt-4">
              {totals.lines.map((l, i) => (
                <div key={i} className="space-y-0.5 border-b py-1 last:border-b-0">
                  <div className="flex justify-between">
                    <span className="font-medium">{l.label}</span>
                    <span className="tabular-nums">
                      {l.original_gross != null && l.original_gross !== l.gross && (
                        <span className="mr-1 text-xs text-muted-foreground line-through">
                          {money(l.original_gross, currency)}
                        </span>
                      )}
                      {money(l.gross, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      {l.qty} · {l.basis} · tax {l.tax_rate_pct}%
                      {l.discount_applied != null && l.discount_applied > 0 && (
                        <> · discount -{money(l.discount_applied, currency)}</>
                      )}
                    </span>
                    <span className="tabular-nums">
                      net {money(l.net, currency)} · tax {money(l.tax, currency)}
                    </span>
                  </div>
                </div>
              ))}

              {CATEGORY_KEYS.some((c) => (alternativesByCategory[c]?.length ?? 0) > 0) && (
                <div className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Shown, not charged</span>
                  {CATEGORY_KEYS.map((c) => {
                    const ids = alternativesByCategory[c] ?? [];
                    if (!ids.length) return null;
                    return (
                      <div key={c}>
                        {CATEGORY_LABELS[c]} alternatives: {ids.map((id) => itemName(id)).join(", ")}
                        {!offerAlternatives[c] && " (hidden from client)"}
                      </div>
                    );
                  })}
                </div>
              )}


              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Net subtotal</span><span className="tabular-nums">{money(totals.net_subtotal, currency)}</span></div>
                {totals.discount_targeted && totals.discount_net > 0 && (
                  <div className="flex justify-between text-foreground">
                    <span>Discount (net)</span>
                    <span className="tabular-nums">-{money(totals.discount_net, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between"><span>Total tax</span><span className="tabular-nums">{money(totals.tax_subtotal, currency)}</span></div>
                <div className="flex justify-between"><span>Gross subtotal</span><span className="tabular-nums">{money(totals.gross_subtotal, currency)}</span></div>
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                {!totals.discount_targeted && effectiveDiscount > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">-{money(effectiveDiscount, currency)}</span></div>
                )}
                <div className="flex justify-between"><span>{totals.gratuity_label}</span><span className="tabular-nums">{money(totals.gratuity_gross, currency)}</span></div>
              </div>


              <div className="mt-3 rounded-lg bg-primary/10 text-foreground border border-primary/20 p-3 flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Grand total</span>
                <span className="text-lg font-semibold tabular-nums tracking-tight text-primary">{money(totals.grand_total, currency)}</span>
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
            <div className="border-t bg-background/95 p-3 flex flex-col gap-2">
              {requireApproval ? (
                (() => {
                  const status = deal.approval_status;
                  const isPending = status === "pending";
                  const isApproved = status === "approved";
                  const canApprove = isPending && userId != null && deal.approval_requested_by !== userId;
                  const waitingOnOthers = isPending && !canApprove;
                  return (
                    <>
                      {status === "changes_requested" && deal.approval_note && (
                        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
                          <div className="font-semibold">Changes requested</div>
                          <div className="mt-0.5 whitespace-pre-wrap">{deal.approval_note}</div>
                        </div>
                      )}
                      {isApproved && (
                        <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">
                          <ShieldCheck className="h-4 w-4 shrink-0" />
                          <span className="font-medium">Approved — ready to send.</span>
                        </div>
                      )}
                      <Button onClick={() => saveProposal(false)} variant="outline" className="w-full">
                        Save draft
                      </Button>
                      {(status === "not_required" || status === "changes_requested") && (
                        <Button onClick={sendForApproval} className="w-full">
                          <ShieldCheck className="mr-1 h-4 w-4" /> Send for approval
                        </Button>
                      )}
                      {waitingOnOthers && (
                        <Button disabled className="w-full">
                          <Clock className="mr-1 h-4 w-4" /> Waiting for approval
                        </Button>
                      )}
                      {canApprove && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={approveDeal} className="w-full">
                            <ShieldCheck className="mr-1 h-4 w-4" /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => { setApprovalNoteDraft(""); setApprovalNoteOpen(true); }}
                            className="w-full"
                          >
                            Request changes
                          </Button>
                        </div>
                      )}
                      <Button
                        onClick={() => saveProposal(true)}
                        className="w-full"
                        disabled={!isApproved}
                        title={!isApproved ? "Needs internal approval first" : undefined}
                      >
                        <Send className="mr-1 h-4 w-4" /> Send to client
                      </Button>
                    </>
                  );
                })()
              ) : (
                <>
                  <Button onClick={() => saveProposal(false)} variant="outline" className="w-full">Save draft</Button>
                  <Button onClick={() => saveProposal(true)} className="w-full">
                    <Send className="mr-1 h-4 w-4" /> Send to client
                  </Button>
                </>
              )}
            </div>
            <div id="contracts-panel" className="border-t bg-background/95 p-3 scroll-mt-4">
              <ContractsPanel
                companyId={deal.company_id}
                ctx={{
                  deal,
                  company: { name: undefined, currency },
                  spaces: spaces.filter((s) => selectedSpaces.includes(s.id)).map((s) => ({ name: s.name })),
                  foodPackages: foodPackages.filter((p) => selectedPackages.includes(p.id)).map((p) => ({ name: p.name })),
                  beveragePackages: beveragePackages
                    .filter((p) => selectedPackages.includes(p.id))
                    .map((p) => ({ name: p.name, included_hours: p.included_hours })),
                  extras: extras
                    .filter((e) => selectedExtras.includes(e.id))
                    .map((e) => ({ name: e.name })),
                  staff: staff
                    .filter((x) => selectedStaff.includes(x.id))
                    .map((x) => ({
                      name: x.name,
                      qty: staffConfig[x.id]?.count ?? 1,
                      hours: x.pricing_type === "per_hour" ? staffConfig[x.id]?.hours ?? 1 : undefined,
                    })),
                  totals: totals
                    ? { subtotal: totals.net_subtotal, tax: totals.tax_subtotal, total: totals.grand_total }
                    : undefined,
                  event_hours: (packageHours && Object.values(packageHours)[0]) ?? null,
                  quote_number: (existingProposal as any)?.quote_number ?? null,
                }}
              />
            </div>
            <div id="invoice-panel" className="border-t bg-background/95 p-3 scroll-mt-4">
              <InvoicePanel
                companyId={deal.company_id}
                dealId={deal.id}
                invoiceMode={invoiceMode}
                invoiceNotes={invoiceNotes}
                visible={["signed", "waiting_payment", "invoice_sent", "done", "client_approved"].includes(deal.stage)}
                ctx={{
                  deal,
                  company: { name: undefined, currency },
                  spaces: spaces.filter((s) => selectedSpaces.includes(s.id)).map((s) => ({ name: s.name })),
                  foodPackages: foodPackages.filter((p) => selectedPackages.includes(p.id)).map((p) => ({ name: p.name })),
                  beveragePackages: beveragePackages
                    .filter((p) => selectedPackages.includes(p.id))
                    .map((p) => ({ name: p.name, included_hours: p.included_hours })),
                  extras: extras
                    .filter((e) => selectedExtras.includes(e.id))
                    .map((e) => ({ name: e.name })),
                  staff: staff
                    .filter((x) => selectedStaff.includes(x.id))
                    .map((x) => ({
                      name: x.name,
                      qty: staffConfig[x.id]?.count ?? 1,
                      hours: x.pricing_type === "per_hour" ? staffConfig[x.id]?.hours ?? 1 : undefined,
                    })),
                  totals: totals
                    ? { subtotal: totals.net_subtotal, tax: totals.tax_subtotal, total: totals.grand_total }
                    : undefined,
                  event_hours: (packageHours && Object.values(packageHours)[0]) ?? null,
                  quote_number: (existingProposal as any)?.quote_number ?? null,
                  line_items: totals?.lines.map((l) => ({
                    label: l.label,
                    qty: l.qty,
                    line_total: l.gross,
                  })),
                  service_charge: totals?.gratuity_gross,
                  invoice_notes: invoiceNotes,
                }}
              />
            </div>

          </Card>




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
      </div>
      )}

      {dealTab === "brief" && (
        <EventBriefPanel
          companyId={deal.company_id}
          dealId={deal.id}
          packageIds={selectedPackages}
          briefExtras={{ statusLabel: deal.stage }}
          ctx={{
            deal,
            company: { name: undefined, currency },
            spaces: spaces.filter((s) => selectedSpaces.includes(s.id)).map((s) => ({ name: s.name })),
            foodPackages: foodPackages.filter((p) => selectedPackages.includes(p.id)).map((p) => ({ name: p.name })),
            beveragePackages: beveragePackages
              .filter((p) => selectedPackages.includes(p.id))
              .map((p) => ({ name: p.name, included_hours: p.included_hours })),
            extras: extras.filter((e) => selectedExtras.includes(e.id)).map((e) => ({ name: e.name })),
            staff: staff
              .filter((x) => selectedStaff.includes(x.id))
              .map((x) => ({
                name: x.name,
                qty: staffConfig[x.id]?.count ?? 1,
                hours: x.pricing_type === "per_hour" ? staffConfig[x.id]?.hours ?? 1 : undefined,
              })),
            totals: totals
              ? { subtotal: totals.net_subtotal, tax: totals.tax_subtotal, total: totals.grand_total }
              : undefined,
            event_hours: (packageHours && Object.values(packageHours)[0]) ?? null,
            menu_selections: Object.entries(menuChoicesByPkg).flatMap(([pid, groups]) => {
              const pkgName = packages.find((p) => p.id === pid)?.name ?? "";
              return Object.entries(groups ?? {}).flatMap(([group, items]) =>
                (items ?? []).length ? [`${pkgName} — ${group}: ${(items ?? []).join(", ")}`] : [],
              );
            }),
          }}
        />
      )}
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
  menuModeByPkg, onMenuModeChange, menuChoicesByPkg, onMenuChoiceChange,
  hiddenCount = 0, showAll = false, onShowAllChange, fitLabel = "this deal",
}: {
  hiddenCount?: number;
  showAll?: boolean;
  onShowAllChange?: (v: boolean) => void;
  fitLabel?: string;
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
  menuModeByPkg: Record<string, "manager" | "client">;
  onMenuModeChange: (pid: string, mode: "manager" | "client") => void;
  menuChoicesByPkg: Record<string, Record<string, string[]>>;
  onMenuChoiceChange: (pid: string, groupLabel: string, next: string[]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hiddenCount > 0 && onShowAllChange && (
          <button
            type="button"
            className="w-fit text-xs text-primary underline"
            onClick={() => onShowAllChange(!showAll)}
          >
            {showAll
              ? `Show only options that fit ${fitLabel}`
              : `Show all (${hiddenCount} don't fit ${fitLabel})`}
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <EmptyHint to={emptyTo} label={`Add ${title.toLowerCase()} in catalog`} />}
        {items.map((p) => {
          const checked = selected.includes(p.id);
          const guests = packageGuests[p.id] ?? dealGuests;
          const standardHours = p.included_hours != null ? Number(p.included_hours) : defaultHours;
          const hours = packageHours[p.id] ?? standardHours;
          const overRate = Number(p.overage_price_per_person_per_hour ?? 0);
          const selMode = p.selection_mode ?? "fixed";
          const groups = (Array.isArray(p.selection_groups) ? p.selection_groups : []) as MenuGroupDef[];
          const hasSelection = selMode !== "fixed" && groups.length > 0;
          const pickerMode = menuModeByPkg[p.id] ?? "client";
          return (
            <div key={p.id} className="rounded-md border p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={checked} onCheckedChange={(v) => onToggle(p.id, v)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {money(p.price_per_person, currency)} per guest · {standardHours}h included
                    {overRate > 0 && <> · +{money(overRate, currency)}/guest/h overtime</>}
                  </div>
                  {p.details_url && (
                    <a
                      href={p.details_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-primary underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View details ↗
                    </a>
                  )}
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
              {checked && hasSelection && (
                <div className="mt-3 space-y-2 border-t pt-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">Menu selection</span>
                    <span className="text-muted-foreground">— selected by:</span>
                    <div className="inline-flex overflow-hidden rounded-md border">
                      <button
                        type="button"
                        className={"px-2 py-0.5 " + (pickerMode === "manager" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                        onClick={() => onMenuModeChange(p.id, "manager")}
                      >
                        Manager
                      </button>
                      <button
                        type="button"
                        className={"px-2 py-0.5 " + (pickerMode === "client" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                        onClick={() => onMenuModeChange(p.id, "client")}
                      >
                        Client
                      </button>
                    </div>
                  </div>
                  {pickerMode === "manager" ? (
                    <MenuSelectionPicker
                      groups={groups}
                      totalMax={p.selection_total_max ?? null}
                      value={menuChoicesByPkg[p.id] ?? {}}
                      onChange={(gl, next) => onMenuChoiceChange(p.id, gl, next)}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                      Client will pick menu items in the proposal.
                    </div>
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
  checked, onChange, title, subtitle, link, singleChoice = false, isPrimary = false, onMakePrimary,
}: {
  checked: boolean;
  onChange: (v: boolean | "indeterminate") => void;
  title: string;
  subtitle: string;
  link?: { href: string; label?: string } | null;
  singleChoice?: boolean;
  isPrimary?: boolean;
  onMakePrimary?: () => void;
}) {
  return (
    <div className={"rounded-md border p-3 hover:bg-muted/40 " + (checked && singleChoice && isPrimary ? "border-primary bg-primary/5" : "")}>
      <label className="flex cursor-pointer items-center gap-3">
        <Checkbox checked={checked} onCheckedChange={onChange} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{title}</span>
            {checked && singleChoice && (
              <span className={"rounded px-1.5 py-0.5 text-[10px] " + (isPrimary ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {isPrimary ? "Proposed" : "Alternative"}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
          {link?.href && (
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline"
            >
              {link.label ?? "View space details"} ↗
            </a>
          )}
        </div>
      </label>
      {checked && singleChoice && !isPrimary && onMakePrimary && (
        <button
          type="button"
          className="mt-2 ml-7 text-xs text-primary underline"
          onClick={onMakePrimary}
        >
          Mark as proposed
        </button>
      )}
    </div>
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

/** Internal-only reference: space size + seating capacities, collapsed by default. */
function SeatingSection({
  size,
  capacities,
  value,
  onChange,
}: {
  size: string | null;
  capacities: Record<string, number> | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const entries = SEATING_STYLES.filter((s) => Number(capacities?.[s] ?? 0) > 0).map(
    (s) => [s, Number(capacities![s])] as const,
  );
  if (!size && entries.length === 0) return null;

  return (
    <div className="ml-6 rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="font-medium">Seating arrangements</span>
        <span className="ml-auto text-muted-foreground">{value || "Internal reference"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t px-3 py-2 text-xs">
          {size && (
            <div className="text-muted-foreground">
              Size: <span className="text-foreground">{size}</span>
            </div>
          )}
          {entries.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {entries.map(([style, n]) => (
                  <div key={style} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{style}</span>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-muted-foreground">Used for this event</span>
                <select
                  className="rounded-md border bg-background px-2 py-1 text-xs"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                >
                  <option value="">Not set</option>
                  {entries.map(([style]) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
