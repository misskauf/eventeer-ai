import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveProposalToken, submitClientSelection } from "@/lib/public-share.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

import { computeTotals, money, type Offer, type Selection, type SpaceSel, type PackageSel, type ExtraSel } from "@/lib/pricing";
import { categoryDefaultHours, type CategoryDefaults } from "@/lib/tax";
import { formatEventDate } from "@/lib/date-format";
import { Markdown } from "@/components/markdown";
import { toast } from "sonner";
import { MessageSquare, Download } from "lucide-react";
import { t, pickLocalized, normalizeLang, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  component: ClientProposal,
});

type AlternativeGroup = {
  id: string;
  name: string;
  category: "space" | "food" | "beverage" | "extra";
  item_ids: string[];
  default_id: string;
};

function ClientProposal() {
  const { token } = Route.useParams();
  const resolve = useServerFn(resolveProposalToken);
  const submit = useServerFn(submitClientSelection);

  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<SpaceSel[]>([]);
  const [packages, setPackages] = useState<PackageSel[]>([]);
  const [extras, setExtras] = useState<ExtraSel[]>([]);
  const [seasonMult, setSeasonMult] = useState(1);
  const [minRev, setMinRev] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [servicePct, setServicePct] = useState<number | null>(null);
  const [feesCfg, setFeesCfg] = useState<any>(null);
  const [coverTitle, setCoverTitle] = useState<string>("");
  const [introMarkdown, setIntroMarkdown] = useState<string>("");
  const [altGroups, setAltGroups] = useState<AlternativeGroup[]>([]);
  const [discountTarget, setDiscountTarget] = useState<{ kind: "space" | "package" | "extra"; id: string } | null>(null);
  const [menuModeByPkg, setMenuModeByPkg] = useState<Record<string, "manager" | "client">>({});
  const [managerMenuChoices, setManagerMenuChoices] = useState<Record<string, Record<string, string[]>>>({});

  const [baseSpaces, setBaseSpaces] = useState<string[]>([]);
  const [basePkgs, setBasePkgs] = useState<string[]>([]);
  const [baseExtras, setBaseExtras] = useState<string[]>([]);
  const [selSpaces, setSelSpaces] = useState<string[]>([]);
  const [selFoodPkgs, setSelFoodPkgs] = useState<string[]>([]);
  const [selBevPkgs, setSelBevPkgs] = useState<string[]>([]);
  const [selExtras, setSelExtras] = useState<string[]>([]);
  const [packageGuests, setPackageGuests] = useState<Record<string, number>>({});
  const [packageHours, setPackageHours] = useState<Record<string, number>>({});
  const [altChoices, setAltChoices] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  // menuChoices: { [packageId]: { [groupLabel]: string[] } }
  const [menuChoices, setMenuChoices] = useState<Record<string, Record<string, string[]>>>({});
  const [openNoteFor, setOpenNoteFor] = useState<Record<string, boolean>>({});
  const [overallMessage, setOverallMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedAction, setSubmittedAction] = useState<"confirmed" | "changes_requested" | "declined" | null>(null);
  const [pendingAction, setPendingAction] = useState<"confirmed" | "changes_requested" | "declined" | null>(null);
  const [actionNote, setActionNote] = useState("");

  useEffect(() => {
    (async () => {
      const res = await resolve({ data: { token } });
      if (!res.ok) return setError(res.reason ?? "not_found");
      setState(res);
      const offerCfg: any = res.proposal.offer ?? {};
      const cons: any = res.proposal.constraints ?? {};

      const groups: AlternativeGroup[] = offerCfg.alternative_groups ?? [];
      const allGroupItemIds = new Set<string>();
      for (const g of groups) for (const iid of g.item_ids) allGroupItemIds.add(iid);

      const spaceIds = [...(offerCfg.space_ids ?? []), ...groups.filter(g => g.category === "space").flatMap(g => g.item_ids)];
      const pkgIds = [...(offerCfg.package_ids ?? []), ...groups.filter(g => g.category === "food" || g.category === "beverage").flatMap(g => g.item_ids)];
      const extraIds = [...(offerCfg.extra_ids ?? []), ...groups.filter(g => g.category === "extra").flatMap(g => g.item_ids)];

      setSpaces(((res as any).spaces ?? []) as SpaceSel[]);
      setPackages(((res as any).packages ?? []) as PackageSel[]);
      setExtras(((res as any).extras ?? []) as ExtraSel[]);
      setFeesCfg((res as any).feeConfig ?? {});
      setSeasonMult(Number((res as any).seasonMultiplier ?? 1));

      setDiscount(Number(offerCfg.discount ?? 0));
      setMinRev(Number(offerCfg.min_revenue_required ?? 0));
      const fcData: any = (res as any).feeConfig ?? {};
      const gratDefault =
        fcData?.gratuity_mode === "fixed"
          ? Number(fcData?.gratuity_fixed_pct ?? 0)
          : Number(fcData?.gratuity_default_pct ?? fcData?.service_charge_pct ?? 0);
      setServicePct(
        typeof offerCfg.service_charge_pct_override === "number"
          ? offerCfg.service_charge_pct_override
          : gratDefault,
      );

      setCoverTitle(offerCfg.cover_title ?? "");
      setIntroMarkdown(cons.intro_markdown ?? cons.client_message ?? "");
      setAltGroups(groups);
      setDiscountTarget(offerCfg.discount_target ?? null);
      setMenuModeByPkg(offerCfg.menu_selection_mode_by_pkg ?? {});
      setManagerMenuChoices(offerCfg.menu_choices_by_pkg ?? {});

      const bSpaces: string[] = offerCfg.space_ids ?? [];
      const bPkgs: string[] = offerCfg.package_ids ?? [];
      const bExtras: string[] = offerCfg.extra_ids ?? [];
      setBaseSpaces(bSpaces);
      setBasePkgs(bPkgs);
      setBaseExtras(bExtras);

      // Partition base packages into food vs beverage using the fetched catalog.
      const pkgList = ((res as any).packages ?? []) as PackageSel[];
      const groupItemIds = new Set<string>(groups.flatMap((g) => g.item_ids));
      const bFood = bPkgs.filter((id) => {
        const p = pkgList.find((x) => x.id === id);
        return p && (p.kind ?? "food") === "food" && !groupItemIds.has(id);
      });
      const bBev = bPkgs.filter((id) => {
        const p = pkgList.find((x) => x.id === id);
        return p && p.kind === "beverage" && !groupItemIds.has(id);
      });
      const bSpacesNonGroup = bSpaces.filter((id) => !groupItemIds.has(id));

      // Single-choice defaults: pick the first item in each category (if any).
      setSelSpaces(bSpacesNonGroup.length ? [bSpacesNonGroup[0]] : []);
      setSelFoodPkgs(bFood.length ? [bFood[0]] : []);
      setSelBevPkgs(bBev.length ? [bBev[0]] : []);
      // Extras remain multi-select, pre-checked as the manager included them.
      setSelExtras(bExtras.filter((id) => !groupItemIds.has(id)));

      setPackageGuests(offerCfg.package_guests ?? {});
      // Seed beverage hours from each package's included hours, falling back to the company default.
      const hoursSeed: Record<string, number> = {};
      const defaultBeverageHours = categoryDefaultHours(fcData as CategoryDefaults, "beverage");
      const allBeverageIds = Array.from(
        new Set([
          ...bBev,
          ...groups.filter((g) => g.category === "beverage").flatMap((g) => g.item_ids),
        ]),
      );
      const savedPackageHours = (offerCfg.package_hours ?? {}) as Record<string, number>;
      for (const id of allBeverageIds) {
        const p = pkgList.find((x) => x.id === id);
        if (p?.kind === "beverage") {
          const standardHours = p.included_hours != null ? Number(p.included_hours) : defaultBeverageHours;
          hoursSeed[id] = Number(savedPackageHours[id] ?? standardHours);
        }
      }
      setPackageHours(hoursSeed);
      const defaults: Record<string, string> = {};
      for (const g of groups) {
        defaults[g.id] = g.default_id && g.item_ids.includes(g.default_id) ? g.default_id : g.item_ids[0] ?? "";
      }
      setAltChoices(defaults);
    })();
  }, [token]);

  // Merge alt-group choices into the resolved selection used for totals.
  const resolvedSelection: Selection | null = useMemo(() => {
    if (!state) return null;
    const spaceExtra: string[] = [];
    const pkgExtra: string[] = [];
    const extExtra: string[] = [];
    for (const g of altGroups) {
      const chosen = altChoices[g.id];
      if (!chosen) continue;
      if (g.category === "space") spaceExtra.push(chosen);
      else if (g.category === "extra") extExtra.push(chosen);
      else pkgExtra.push(chosen);
    }
    return {
      guest_count: state.deal.guest_count,
      space_ids: Array.from(new Set([...selSpaces, ...spaceExtra])),
      package_ids: Array.from(new Set([...selFoodPkgs, ...selBevPkgs, ...pkgExtra])),
      extra_ids: Array.from(new Set([...selExtras, ...extExtra])),
      package_guests: packageGuests,
      package_hours: packageHours,
      event_date: state.deal.event_date ?? null,
    };
  }, [state, selSpaces, selFoodPkgs, selBevPkgs, selExtras, packageGuests, packageHours, altGroups, altChoices]);

  const offer: Offer | null = useMemo(() => {
    if (!feesCfg) return null;
    const fcAny = feesCfg as any;
    const gMode = fcAny?.gratuity_mode ?? "slider";
    const gFixed = Number(fcAny?.gratuity_fixed_pct ?? 0);
    const effectiveService =
      gMode === "fixed"
        ? gFixed
        : servicePct != null
        ? servicePct
        : Number(fcAny?.gratuity_default_pct ?? feesCfg.service_charge_pct ?? 0);
    return {
      spaces, packages, extras,
      fees: {
        ...feesCfg,
        service_charge_pct: effectiveService,
        overtime_hours: 0,
        gratuity_type: fcAny?.gratuity_type ?? "service_charge",
        gratuity_tax_rate_pct: Number(fcAny?.gratuity_tax_rate_pct ?? 0),
      },
      category_defaults: feesCfg,
      season_multiplier: seasonMult,
      min_revenue_required: minRev,
      discount,
      discount_target: discountTarget,
      currency: state?.company?.currency ?? "USD",
    };
  }, [spaces, packages, extras, feesCfg, seasonMult, discount, discountTarget, minRev, servicePct, state?.company?.currency]);


  const totals = useMemo(() => {
    if (!offer || !resolvedSelection) return null;
    return computeTotals(offer, resolvedSelection);
  }, [offer, resolvedSelection]);

  const lang: Lang = normalizeLang(state?.deal?.language);
  if (error === "expired") return <Message title={t(lang, "expired_title")} body={t(lang, "expired_body")} />;
  if (error) return <Message title={t(lang, "not_found_title")} body={t(lang, "not_found_body")} />;
  if (!state || !totals) return <div className="p-8 text-center text-muted-foreground">{t(lang, "loading")}</div>;

  const brand = (state.company.primary_color as string) || "#0f172a";
  const currency = state.company.currency as string;

  // Filter items shown in the free-pick lists to those the manager included as "base" (not part of any alt group).
  const groupItemSet = new Set<string>(altGroups.flatMap((g) => g.item_ids));
  const baseSpaceItems = spaces.filter((s) => baseSpaces.includes(s.id) && !groupItemSet.has(s.id));
  const basePkgFood = packages.filter((p) => (p.kind ?? "food") === "food" && basePkgs.includes(p.id) && !groupItemSet.has(p.id));
  const basePkgBev = packages.filter((p) => p.kind === "beverage" && basePkgs.includes(p.id) && !groupItemSet.has(p.id));
  const baseExtraItems = extras.filter((e) => baseExtras.includes(e.id) && !groupItemSet.has(e.id));

  async function onSubmit(action: "confirmed" | "changes_requested" | "declined") {
    if (action === "changes_requested" && !actionNote.trim()) {
      toast.error("Please add a short note describing the changes you'd like.");
      return;
    }
    if (state?.preview) {
      const label =
        action === "confirmed"
          ? t(lang, "confirm_selection")
          : action === "changes_requested"
          ? t(lang, "request_changes")
          : t(lang, "decline_offer");
      toast.info(`Preview mode — "${label}" was not submitted.`);
      return;
    }
    await submit({
      data: {
        token,
        action,
        note: actionNote.trim() || undefined,
        selection: {
          guest_count: state.deal.guest_count,
          space_ids: resolvedSelection!.space_ids,
          package_ids: resolvedSelection!.package_ids,
          extra_ids: resolvedSelection!.extra_ids,
          package_guests: packageGuests,
          package_hours: packageHours,
        },
        computed_total: totals!.grand_total,
        client_response: {
          overall_message: overallMessage || undefined,
          item_notes: Object.fromEntries(Object.entries(itemNotes).filter(([, v]) => v?.trim())),
          selected_alternatives: altChoices,
          menu_choices: menuChoices,
        },
      },
    });
    setSubmitted(true);
    setSubmittedAction(action);
    const successMsg =
      action === "confirmed"
        ? t(lang, "selection_confirmed")
        : action === "changes_requested"
        ? t(lang, "change_request_sent")
        : t(lang, "response_recorded");
    toast.success(successMsg);
  }


  const noteToggle = (itemId: string) =>
    setOpenNoteFor((cur) => ({ ...cur, [itemId]: !cur[itemId] }));

  return (
    <div className="min-h-screen bg-muted/20 printable">
      <style>{`
        @media print {
          .printable button, .printable [role="button"] { display: none !important; }
          .printable .max-h-\\[60vh\\],
          .printable [class*="max-h-"] { max-height: none !important; overflow: visible !important; }
          .printable .overflow-y-auto,
          .printable .overflow-auto { overflow: visible !important; }
          .printable header { border-top-width: 6px !important; }
        }
      `}</style>
      {state.preview && (
        <div className="bg-amber-500 py-1.5 text-center text-xs font-medium text-amber-950 no-print">
          Preview mode — this is exactly what your client will see. Nothing gets submitted.
        </div>
      )}

      {/* Branded hero */}
      <header
        className="border-b bg-background"
        style={{ borderTopColor: brand, borderTopWidth: 6 }}
      >
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-6">
          {state.company.logo_url ? (
            <img src={state.company.logo_url} className="h-14 w-14 rounded object-cover" alt="" />
          ) : (
            <div
              className="grid h-14 w-14 place-items-center rounded text-lg font-semibold text-white"
              style={{ backgroundColor: brand }}
            >
              {state.company.name?.[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm text-muted-foreground">{state.company.name}</div>
            <h1 className="text-2xl font-semibold leading-tight">
              {coverTitle || `Proposal for ${state.deal.client_name}`}
            </h1>
            <div className="mt-0.5 text-xs text-muted-foreground">
              For {state.deal.client_name}
              {state.deal.event_date && ` · ${formatEventDate(state.deal.event_date)}`}
              {state.deal.guest_count > 0 && ` · ${state.deal.guest_count} guests`}
            </div>
          </div>
          <div className="no-print">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="mr-1 h-4 w-4" /> {t(lang, "download_pdf")}
            </Button>
          </div>
        </div>
      </header>


      <main className="mx-auto max-w-4xl px-6 py-8">
        {introMarkdown && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Markdown source={introMarkdown} />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Alternative groups — client picks exactly one */}
            {altGroups.map((g) => {
              const items = itemsForGroup(g, spaces, packages, extras, lang);
              if (items.length === 0) return null;
              return (
                <Card key={g.id} style={{ borderLeftColor: brand, borderLeftWidth: 3 }}>
                  <CardHeader>
                    <CardTitle className="text-base">{g.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t(lang, "choose_one")}</p>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={altChoices[g.id] ?? ""}
                      onValueChange={(v) => setAltChoices((cur) => ({ ...cur, [g.id]: v }))}
                      className="space-y-2"
                    >
                      {items.map((it) => {
                        const beveragePackage = g.category === "beverage" ? packages.find((x) => x.id === it.id) : null;
                        const beverageStandardHours = beveragePackage
                          ? beveragePackage.included_hours != null
                            ? Number(beveragePackage.included_hours)
                            : categoryDefaultHours(feesCfg as CategoryDefaults, "beverage")
                          : null;
                        const isSelectedBeverage = g.category === "beverage" && altChoices[g.id] === it.id && beveragePackage;
                        return (
                          <label
                            key={it.id}
                            className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"
                          >
                            <RadioGroupItem value={it.id} className="mt-1" />
                            <div className="flex-1">
                              <div className="font-medium">{it.name}</div>
                              <div className="text-xs text-muted-foreground">{it.note}</div>
                              {it.details && <Markdown source={it.details} className="mt-2" />}
                              {isSelectedBeverage && beverageStandardHours != null && (
                                <BeverageHoursField
                                  packageId={beveragePackage.id}
                                  includedHours={beverageStandardHours}
                                  currentHours={packageHours[beveragePackage.id] ?? beverageStandardHours}
                                  overageRate={Number(beveragePackage.overage_price_per_person_per_hour ?? 0)}
                                  currency={currency}
                                  onHoursChange={(id, value) => setPackageHours((cur) => ({ ...cur, [id]: value }))}
                                  lang={lang}
                                />
                              )}
                              <NoteToggle
                                itemId={it.id}
                                open={!!openNoteFor[it.id]}
                                value={itemNotes[it.id] ?? ""}
                                onToggle={() => noteToggle(it.id)}
                                onChange={(v) => setItemNotes((cur) => ({ ...cur, [it.id]: v }))}
                                lang={lang}
                              />
                            </div>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </CardContent>
                </Card>
              );
            })}

            {baseSpaceItems.length > 0 && (
              <SingleChoiceSpaces
                items={baseSpaceItems}
                currency={currency}
                selectedId={selSpaces[0] ?? ""}
                onChange={(id) => setSelSpaces([id])}
                itemNotes={itemNotes}
                openNoteFor={openNoteFor}
                onToggleNote={noteToggle}
                onNoteChange={(id, v) => setItemNotes((cur) => ({ ...cur, [id]: v }))}
                lang={lang}
              />
            )}
            {basePkgFood.length > 0 && (
              <SingleChoicePackages
                title={t(lang, "section_food")}
                items={basePkgFood}
                currency={currency}
                selectedId={selFoodPkgs[0] ?? ""}
                onChange={(id) => setSelFoodPkgs([id])}
                dealGuests={state.deal.guest_count}
                packageGuests={packageGuests}
                onGuestChange={(id, v) => setPackageGuests((c) => ({ ...c, [id]: v }))}
                itemNotes={itemNotes}
                openNoteFor={openNoteFor}
                onToggleNote={noteToggle}
                onNoteChange={(id, v) => setItemNotes((cur) => ({ ...cur, [id]: v }))}
                menuChoices={menuChoices}
                onMenuChoiceChange={(pkgId, groupLabel, next) =>
                  setMenuChoices((cur) => ({ ...cur, [pkgId]: { ...(cur[pkgId] ?? {}), [groupLabel]: next } }))
                }
                menuModeByPkg={menuModeByPkg}
                managerMenuChoices={managerMenuChoices}
                lang={lang}
              />
            )}
            {basePkgBev.length > 0 && (
              <SingleChoicePackages
                title={t(lang, "section_beverages")}
                items={basePkgBev}
                currency={currency}
                selectedId={selBevPkgs[0] ?? ""}
                onChange={(id) => setSelBevPkgs([id])}
                dealGuests={state.deal.guest_count}
                packageGuests={packageGuests}
                onGuestChange={(id, v) => setPackageGuests((c) => ({ ...c, [id]: v }))}
                packageHours={packageHours}
                onHoursChange={(id, v) => setPackageHours((c) => ({ ...c, [id]: v }))}
                defaultHours={categoryDefaultHours(feesCfg as CategoryDefaults, "beverage")}
                itemNotes={itemNotes}
                openNoteFor={openNoteFor}
                onToggleNote={noteToggle}
                onNoteChange={(id, v) => setItemNotes((cur) => ({ ...cur, [id]: v }))}
                menuChoices={menuChoices}
                onMenuChoiceChange={(pkgId, groupLabel, next) =>
                  setMenuChoices((cur) => ({ ...cur, [pkgId]: { ...(cur[pkgId] ?? {}), [groupLabel]: next } }))
                }
                menuModeByPkg={menuModeByPkg}
                managerMenuChoices={managerMenuChoices}
                lang={lang}
              />
            )}
            {baseExtraItems.length > 0 && (
              <OptionGroup
                title={t(lang, "section_extras")}
                items={baseExtraItems.map((e) => ({
                  id: e.id, name: pickLocalized(e, lang, "name"),
                  note: `${money(e.price, currency)} ${e.pricing_type.replace("_", " ")}`,
                  details: pickLocalized(e, lang, "long_description") || null,
                }))}
                selected={selExtras}
                onToggle={(id, v) => toggle(setSelExtras, id, v)}
                itemNotes={itemNotes}
                openNoteFor={openNoteFor}
                onToggleNote={noteToggle}
                onNoteChange={(id, v) => setItemNotes((cur) => ({ ...cur, [id]: v }))}
                lang={lang}
              />
            )}

            {/* Overall message */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" /> {t(lang, "message_to_manager")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={4}
                  value={overallMessage}
                  onChange={(e) => setOverallMessage(e.target.value)}
                  placeholder={t(lang, "message_placeholder")}
                />
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-4">
              <CardHeader><CardTitle>Your total</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
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
                        {l.qty}
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
                <Separator className="my-2" />
                <Row label="Net" value={money(totals.net_subtotal, currency)} />
                {totals.discount_targeted && totals.discount_net > 0 && (
                  <Row label="Discount (net)" value={"-" + money(totals.discount_net, currency)} />
                )}
                <Row label="Tax" value={money(totals.tax_subtotal, currency)} />
                <Row label="Gross" value={money(totals.gross_subtotal, currency)} />
                {!totals.discount_targeted && discount > 0 && <Row label="Discount" value={"-" + money(discount, currency)} />}
                {(() => {
                  const fcAny = feesCfg as any;
                  const gMode = fcAny?.gratuity_mode ?? "slider";
                  const gMin = Number(fcAny?.gratuity_min_pct ?? 0);
                  const gMax = Number(fcAny?.gratuity_max_pct ?? 20);
                  const label = totals.gratuity_label;
                  return (
                    <>
                      {gMode === "slider" && gMax > gMin && (
                        <div className="mt-2 space-y-1 rounded-md border p-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{label}</span>
                            <span className="tabular-nums">
                              {(servicePct ?? gMin).toFixed(1)}%
                            </span>
                          </div>
                          <Slider
                            value={[Math.max(gMin, Math.min(gMax, servicePct ?? gMin))]}
                            min={gMin}
                            max={gMax}
                            step={0.5}
                            onValueChange={(v) => setServicePct(v[0] ?? gMin)}
                          />
                        </div>
                      )}
                      <Row label={label} value={money(totals.gratuity_gross, currency)} />
                    </>
                  );
                })()}
                <Separator className="my-2" />
                <Row label={<b>Grand total</b>} value={<b>{money(totals.grand_total, currency)}</b>} />

                {totals.min_shortfall > 0 && (
                  <div className="mt-3 rounded-md bg-yellow-50 p-2 text-xs text-yellow-900">
                    Add {money(totals.min_shortfall, currency)} more to meet the venue minimum.
                  </div>
                )}
                {submitted ? (
                  <div
                    className={
                      "mt-4 rounded-md border p-3 text-sm " +
                      (submittedAction === "confirmed"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : submittedAction === "changes_requested"
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-slate-200 bg-slate-50 text-slate-800")
                    }
                  >
                    <div className="font-medium">
                      {submittedAction === "confirmed"
                        ? "Selection confirmed"
                        : submittedAction === "changes_requested"
                        ? "Change request sent"
                        : "Response recorded"}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      {submittedAction === "confirmed"
                        ? "The event manager has been notified and will follow up shortly."
                        : submittedAction === "changes_requested"
                        ? "The event manager will review your notes and send an updated proposal."
                        : "Thanks for letting us know."}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {pendingAction && pendingAction !== "confirmed" && (
                      <div className="rounded-md border p-3">
                        <Label className="text-xs">
                          {pendingAction === "changes_requested"
                            ? "What would you like to change? (required)"
                            : "Reason for declining (optional)"}
                        </Label>
                        <Textarea
                          rows={3}
                          className="mt-1"
                          value={actionNote}
                          onChange={(e) => setActionNote(e.target.value)}
                          placeholder={
                            pendingAction === "changes_requested"
                              ? "e.g. Please swap the beverage package…"
                              : "e.g. We chose another venue"
                          }
                        />
                      </div>
                    )}
                    <Button
                      className="w-full"
                      style={{ backgroundColor: brand }}
                      onClick={() => {
                        if (pendingAction === "changes_requested" || pendingAction === "declined") {
                          onSubmit(pendingAction);
                        } else {
                          setPendingAction("confirmed");
                          onSubmit("confirmed");
                        }
                      }}
                    >
                      {state.preview
                        ? pendingAction === "changes_requested"
                          ? "Send change request (preview)"
                          : pendingAction === "declined"
                          ? "Send decline (preview)"
                          : "Confirm (preview)"
                        : pendingAction === "changes_requested"
                        ? "Send change request"
                        : pendingAction === "declined"
                        ? "Send decline"
                        : "Confirm my selection"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setPendingAction(pendingAction === "changes_requested" ? null : "changes_requested");
                        setActionNote("");
                      }}
                    >
                      {pendingAction === "changes_requested" ? "Cancel change request" : "Request changes"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => {
                        setPendingAction(pendingAction === "declined" ? null : "declined");
                        setActionNote("");
                      }}
                    >
                      {pendingAction === "declined" ? "Cancel decline" : "Decline offer"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function itemsForGroup(
  g: AlternativeGroup,
  spaces: SpaceSel[],
  packages: PackageSel[],
  extras: ExtraSel[],
) {
  return g.item_ids
    .map((iid) => {
      if (g.category === "space") {
        const s = spaces.find((x) => x.id === iid);
        return s ? { id: s.id, name: s.name, note: "", details: s.long_description } : null;
      }
      if (g.category === "extra") {
        const e = extras.find((x) => x.id === iid);
        return e ? { id: e.id, name: e.name, note: e.pricing_type.replace("_", " "), details: e.long_description } : null;
      }
      const p = packages.find((x) => x.id === iid);
      return p ? { id: p.id, name: p.name, note: `per guest`, details: p.long_description } : null;
    })
    .filter(Boolean) as { id: string; name: string; note: string; details?: string | null }[];
}

function OptionGroup({
  title, items, selected, onToggle,
  itemNotes, openNoteFor, onToggleNote, onNoteChange,
}: {
  title: string;
  items: { id: string; name: string; note: string; details?: string | null }[];
  selected: string[];
  onToggle: (id: string, v: boolean | "indeterminate") => void;
  itemNotes: Record<string, string>;
  openNoteFor: Record<string, boolean>;
  onToggleNote: (id: string) => void;
  onNoteChange: (id: string, v: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((i) => (
          <label key={i.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40">
            <Checkbox checked={selected.includes(i.id)} onCheckedChange={(v) => onToggle(i.id, v)} className="mt-1" />
            <div className="flex-1">
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-muted-foreground">{i.note}</div>
              {i.details && <Markdown source={i.details} className="mt-2" />}
              <NoteToggle
                itemId={i.id}
                open={!!openNoteFor[i.id]}
                value={itemNotes[i.id] ?? ""}
                onToggle={() => onToggleNote(i.id)}
                onChange={(v) => onNoteChange(i.id, v)}
              />
            </div>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function SingleChoiceSpaces({
  items, currency, selectedId, onChange,
  itemNotes, openNoteFor, onToggleNote, onNoteChange,
}: {
  items: SpaceSel[];
  currency: string;
  selectedId: string;
  onChange: (id: string) => void;
  itemNotes: Record<string, string>;
  openNoteFor: Record<string, boolean>;
  onToggleNote: (id: string) => void;
  onNoteChange: (id: string, v: string) => void;
}) {
  if (items.length === 0) return null;
  const multi = items.length > 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Space</CardTitle>
        <p className="text-xs text-muted-foreground">
          {multi ? "Choose one" : "Included in your proposal"}
        </p>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedId}
          onValueChange={(v) => onChange(v)}
          className="space-y-2"
        >
          {items.map((s) => {
            const isSelected = s.id === selectedId;
            return (
              <label
                key={s.id}
                className={
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40 " +
                  (isSelected ? "border-primary" : "")
                }
              >
                {multi ? (
                  <RadioGroupItem value={s.id} className="mt-1" />
                ) : (
                  <div className="mt-1 h-4 w-4 rounded-full bg-primary/80" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    From {money(s.base_rental_fee, currency)}
                  </div>
                  {s.long_description && <Markdown source={s.long_description} className="mt-2" />}
                  <NoteToggle
                    itemId={s.id}
                    open={!!openNoteFor[s.id]}
                    value={itemNotes[s.id] ?? ""}
                    onToggle={() => onToggleNote(s.id)}
                    onChange={(v) => onNoteChange(s.id, v)}
                  />
                </div>
              </label>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

function SingleChoicePackages({
  title, items, currency, selectedId, onChange, dealGuests, packageGuests, onGuestChange,
  packageHours, onHoursChange, defaultHours,
  itemNotes, openNoteFor, onToggleNote, onNoteChange,
  menuChoices, onMenuChoiceChange,
  menuModeByPkg, managerMenuChoices,
}: {
  title: string;
  items: PackageSel[];
  currency: string;
  selectedId: string;
  onChange: (id: string) => void;
  dealGuests: number;
  packageGuests: Record<string, number>;
  onGuestChange: (id: string, v: number) => void;
  packageHours?: Record<string, number>;
  onHoursChange?: (id: string, v: number) => void;
  defaultHours?: number;
  itemNotes: Record<string, string>;
  openNoteFor: Record<string, boolean>;
  onToggleNote: (id: string) => void;
  onNoteChange: (id: string, v: string) => void;
  menuChoices: Record<string, Record<string, string[]>>;
  onMenuChoiceChange: (pkgId: string, groupLabel: string, next: string[]) => void;
  menuModeByPkg: Record<string, "manager" | "client">;
  managerMenuChoices: Record<string, Record<string, string[]>>;
}) {
  if (items.length === 0) return null;
  const multi = items.length > 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {multi ? "Choose one" : "Included in your proposal"}
        </p>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedId}
          onValueChange={(v) => onChange(v)}
          className="space-y-2"
        >
          {items.map((p) => {
            const isSelected = p.id === selectedId;
            const guests = packageGuests[p.id] ?? dealGuests;
            const includedH = p.included_hours != null ? Number(p.included_hours) : defaultHours ?? null;
            const currentH = includedH != null ? packageHours?.[p.id] ?? includedH : 0;
            const mode = p.selection_mode ?? "fixed";
            const groups = Array.isArray(p.selection_groups) ? p.selection_groups : [];
            return (
              <div
                key={p.id}
                className={"rounded-md border p-3 " + (isSelected ? "border-primary" : "")}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  {multi ? (
                    <RadioGroupItem value={p.id} className="mt-1" />
                  ) : (
                    <div className="mt-1 h-4 w-4 rounded-full bg-primary/80" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {money(p.price_per_person, currency)} / guest
                      {includedH != null && <> · {includedH}h included</>}
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
                    {p.long_description && <Markdown source={p.long_description} className="mt-2" />}
                  </div>
                </label>
                {isSelected && (
                  <div className="mt-2 flex flex-wrap items-center gap-4 border-t pt-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Guests</span>
                      <Input
                        type="number"
                        min={1}
                        value={guests}
                        onChange={(e) => onGuestChange(p.id, Math.max(1, Number(e.target.value) || 1))}
                        className="h-7 w-20"
                      />
                    </div>
                    {onHoursChange && includedH != null && (
                      <BeverageHoursField
                        packageId={p.id}
                        includedHours={includedH}
                        currentHours={currentH}
                        overageRate={Number(p.overage_price_per_person_per_hour ?? 0)}
                        currency={currency}
                        onHoursChange={onHoursChange}
                      />
                    )}
                  </div>
                )}
                {isSelected && mode !== "fixed" && groups.length > 0 && (menuModeByPkg[p.id] ?? "client") === "manager" && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <div className="text-xs font-medium">Menu (selected by the event manager)</div>
                    {groups.map((g) => {
                      const picks = managerMenuChoices[p.id]?.[g.label] ?? [];
                      return (
                        <div key={g.label} className="text-xs">
                          <div className="font-medium">{g.label}</div>
                          {picks.length === 0 ? (
                            <div className="text-muted-foreground">—</div>
                          ) : (
                            <ul className="ml-4 list-disc text-muted-foreground">
                              {picks.map((x) => <li key={x}>{x}</li>)}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {isSelected && mode !== "fixed" && groups.length > 0 && (menuModeByPkg[p.id] ?? "client") === "client" && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    {(() => {
                      const totalMax = (p as any).selection_total_max as number | null | undefined;
                      const totalPicked = groups.reduce(
                        (n, gg) => n + (menuChoices[p.id]?.[gg.label]?.length ?? 0),
                        0,
                      );
                      const totalAtMax = !!(totalMax && totalMax > 0 && totalPicked >= totalMax);
                      return (
                        <>
                          {totalMax && totalMax > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Total menu items: {totalPicked}/{totalMax}
                            </div>
                          )}
                          {groups.map((g) => {
                            const picked = menuChoices[p.id]?.[g.label] ?? [];
                            const atMax = picked.length >= g.max_select;
                            return (
                              <div key={g.label} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium">{g.label}</span>
                                  <span className="text-muted-foreground">
                                    Select up to {g.max_select} · {picked.length}/{g.max_select} selected
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {g.options.map((o) => {
                                    const isPicked = picked.includes(o.label);
                                    const disabled = !isPicked && (atMax || totalAtMax);
                                    return (
                                      <label
                                        key={o.label}
                                        className={
                                          "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs " +
                                          (disabled ? "opacity-50" : "hover:bg-muted/40")
                                        }
                                      >
                                        <Checkbox
                                          checked={isPicked}
                                          disabled={disabled}
                                          onCheckedChange={(v) => {
                                            const next = v
                                              ? Array.from(new Set([...picked, o.label]))
                                              : picked.filter((x) => x !== o.label);
                                            onMenuChoiceChange(p.id, g.label, next);
                                          }}
                                          className="mt-0.5"
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium">{o.label}</div>
                                          {o.description && (
                                            <div className="text-muted-foreground">{o.description}</div>
                                          )}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                )}
                <NoteToggle
                  itemId={p.id}
                  open={!!openNoteFor[p.id]}
                  value={itemNotes[p.id] ?? ""}
                  onToggle={() => onToggleNote(p.id)}
                  onChange={(v) => onNoteChange(p.id, v)}
                />
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

function BeverageHoursField({
  packageId,
  includedHours,
  currentHours,
  overageRate,
  currency,
  onHoursChange,
}: {
  packageId: string;
  includedHours: number;
  currentHours: number;
  overageRate: number;
  currency: string;
  onHoursChange: (id: string, v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground">Event hours</span>
      <Input
        type="number"
        min={includedHours}
        step="0.5"
        value={currentHours}
        onChange={(e) => onHoursChange(packageId, Math.max(includedHours, Number(e.target.value) || includedHours))}
        className="h-7 w-20"
      />
      <span className="text-muted-foreground">standard {includedHours}h</span>
      {overageRate > 0 && (
        <span className="text-muted-foreground">+{money(overageRate, currency)}/guest/h</span>
      )}
      {currentHours > includedHours && (
        <span className="font-medium text-foreground">+{currentHours - includedHours}h extra</span>
      )}
    </div>
  );
}

function NoteToggle({
  itemId, open, value, onToggle, onChange,
}: {
  itemId: string;
  open: boolean;
  value: string;
  onToggle: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="text-[11px] text-muted-foreground underline hover:text-foreground"
      >
        {open ? "Hide note" : value ? "Edit note" : "Add a note"}
      </button>
      {open && (
        <Textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Leave a note about this item"
          className="mt-1 text-xs"
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return <div className="flex justify-between"><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function toggle(set: React.Dispatch<React.SetStateAction<string[]>>, id: string, v: boolean | "indeterminate") {
  set((cur) => (v ? Array.from(new Set([...cur, id])) : cur.filter((x) => x !== id)));
}
