// Server-only: expands an accepted proposal offer into deal_items snapshot rows.
import { computeTotals, type Offer, type Selection } from "@/lib/pricing";

type Row = {
  company_id: string;
  deal_id: string;
  proposal_id: string | null;
  item_type: "space" | "package" | "extra" | "staff";
  item_id: string | null;
  item_name: string;
  space_id: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  line_gross: number;
  unit_cost: number;
  line_cost: number;
  captured_at: string;
};

const WON_STAGES = [
  "client_approved",
  "accepted",
  "signed",
  "waiting_payment",
  "invoice_sent",
  "downpayment_received",
  "paid_in_full",
  "payment_delayed",
];

export { WON_STAGES };

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Rebuild deal_items for one deal. Idempotent. Returns number of rows written. */
export async function snapshotDealItemsAdmin(dealId: string): Promise<{ rows: number; skipped?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select("id, company_id, guest_count, event_date, stage")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return { rows: 0, skipped: "deal not found" };
  if (!WON_STAGES.includes(deal.stage as string)) {
    await supabaseAdmin.from("deal_items").delete().eq("deal_id", dealId);
    return { rows: 0, skipped: "deal not won" };
  }

  const { data: proposals } = await supabaseAdmin
    .from("proposals")
    .select("id, offer, status, version, created_at")
    .eq("deal_id", dealId)
    .order("version", { ascending: false });
  const list = (proposals as any[]) ?? [];
  const proposal = list.find((p) => p.status === "accepted") ?? list[0];
  if (!proposal) return { rows: 0, skipped: "no proposal" };

  const cfg: any = proposal.offer ?? {};
  const groups: Array<{ id: string; category: string; item_ids: string[] }> = cfg.alternative_groups ?? [];
  const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));
  const offeredSpaceIds = uniq([...(cfg.space_ids ?? []), ...groups.filter((g) => g.category === "space").flatMap((g) => g.item_ids)]);
  const offeredPkgIds = uniq([...(cfg.package_ids ?? []), ...groups.filter((g) => g.category === "food" || g.category === "beverage").flatMap((g) => g.item_ids)]);
  const offeredExtraIds = uniq([...(cfg.extra_ids ?? []), ...groups.filter((g) => g.category === "extra").flatMap((g) => g.item_ids)]);
  const offeredStaffIds = uniq([...(cfg.staff_ids ?? []), ...groups.filter((g) => g.category === "staff").flatMap((g) => g.item_ids)]);

  const [spacesRes, pkgRes, extraRes, staffRes, feeRes, seasonRes] = await Promise.all([
    offeredSpaceIds.length
      ? supabaseAdmin.from("spaces").select("id, name, base_rental_fee, min_rental_fee, basis, tax_rate_pct, weekday_pricing, cost").in("id", offeredSpaceIds)
      : Promise.resolve({ data: [] } as any),
    offeredPkgIds.length
      ? supabaseAdmin.from("fb_packages").select("id, name, price_per_person, kind, basis, tax_rate_pct, included_hours, overage_price_per_person_per_hour, cost").in("id", offeredPkgIds)
      : Promise.resolve({ data: [] } as any),
    offeredExtraIds.length
      ? supabaseAdmin.from("extras").select("id, name, pricing_type, price, basis, tax_rate_pct, cost").in("id", offeredExtraIds)
      : Promise.resolve({ data: [] } as any),
    offeredStaffIds.length
      ? supabaseAdmin.from("staff_roles").select("id, name, pricing_type, price, basis, tax_rate_pct, cost").in("id", offeredStaffIds)
      : Promise.resolve({ data: [] } as any),
    supabaseAdmin.from("fee_config").select("*").eq("company_id", deal.company_id).maybeSingle(),
    cfg.season_id && cfg.season_id !== "none"
      ? supabaseAdmin.from("pricing_seasons").select("multiplier").eq("id", cfg.season_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  const feesCfg: any = feeRes.data ?? {};
  const offer: Offer = {
    spaces: ((spacesRes.data as any[]) ?? []) as any,
    packages: ((pkgRes.data as any[]) ?? []) as any,
    extras: ((extraRes.data as any[]) ?? []) as any,
    staff: ((staffRes.data as any[]) ?? []) as any,
    fees: {
      ...feesCfg,
      service_charge_pct: num(cfg.service_charge_pct_override ?? feesCfg.gratuity_default_pct ?? feesCfg.service_charge_pct),
      overtime_hours: 0,
      gratuity_type: feesCfg.gratuity_type ?? "service_charge",
      gratuity_tax_rate_pct: num(feesCfg.gratuity_tax_rate_pct),
    },
    category_defaults: feesCfg,
    season_multiplier: num((seasonRes as any).data?.multiplier, 1),
    min_revenue_required: num(cfg.min_revenue_required),
    discount: num(cfg.discount),
    discount_target: cfg.discount_target ?? null,
  };

  const { data: sels } = await supabaseAdmin
    .from("proposal_selections")
    .select("selection, submitted_at")
    .eq("proposal_id", proposal.id)
    .order("submitted_at", { ascending: false })
    .limit(1);
  const stored = ((sels as any[]) ?? [])[0]?.selection as Partial<Selection> | undefined;

  const selection: Selection = {
    guest_count: num(stored?.guest_count, num(cfg.guest_count, num(deal.guest_count, 0))),
    space_ids: stored?.space_ids ?? cfg.space_ids ?? [],
    package_ids: stored?.package_ids ?? cfg.package_ids ?? [],
    extra_ids: stored?.extra_ids ?? cfg.extra_ids ?? [],
    staff_ids: stored?.staff_ids ?? cfg.staff_ids ?? [],
    staff_config: stored?.staff_config ?? cfg.staff_config ?? {},
    package_guests: stored?.package_guests ?? cfg.package_guests ?? {},
    package_hours: stored?.package_hours ?? cfg.package_hours ?? {},
    event_date: stored?.event_date ?? (deal.event_date as string | null) ?? null,
  };

  let totals;
  try {
    totals = computeTotals(offer, selection);
  } catch {
    return { rows: 0, skipped: "offer could not be priced" };
  }


  // Costs come from the catalog rows fetched above.
  const costMap = new Map<string, number>();
  for (const [kind, rows0] of [
    ["space", spacesRes.data],
    ["package", pkgRes.data],
    ["extra", extraRes.data],
    ["staff", staffRes.data],
  ] as [string, any[]][]) {
    for (const r of rows0 ?? []) costMap.set(`${kind}:${r.id}`, num(r.cost, 0));
  }


  const guests = selection.guest_count;
  const primarySpace = selection.space_ids[0] ?? null;

  const agg = new Map<string, Row>();
  const now = new Date().toISOString();

  for (const line of totals.lines) {
    const kind = line.sourceKind;
    if (!kind || kind === "fee") continue;
    const type = (kind === "package_overtime" ? "package" : kind) as Row["item_type"];
    const id = line.sourceId ?? null;
    const key = `${type}:${id}`;
    const existing = agg.get(key);
    if (existing) {
      existing.line_total += line.net;
      existing.line_gross += line.gross;
      continue;
    }

    let name = line.label;
    let qty = 1;
    let unitPrice = 0;
    let unitCost = costMap.get(key) ?? 0;
    let costQty = 1;

    if (type === "space") {
      const s = (offer.spaces ?? []).find((x) => x.id === id);
      name = s?.name ?? name;
      qty = 1;
      unitPrice = line.gross;
      costQty = 1;
    } else if (type === "package") {
      const p = (offer.packages ?? []).find((x) => x.id === id);
      name = p?.name ?? name;
      qty = selection.package_guests?.[id ?? ""] ?? guests;
      unitPrice = num(p?.price_per_person);
      costQty = qty;
    } else if (type === "extra") {
      const e = (offer.extras ?? []).find((x) => x.id === id);
      name = e?.name ?? name;
      unitPrice = num(e?.price);
      qty = e?.pricing_type === "per_person" ? guests : e?.pricing_type === "per_hour" ? num(e?.hours, 1) : 1;
      costQty = qty;
    } else {
      const st = (offer.staff ?? []).find((x) => x.id === id);
      const cfg = selection.staff_config?.[id ?? ""] ?? {};
      const count = Math.max(1, num(cfg.count, 1));
      name = st?.name ?? name;
      unitPrice = num(st?.price);
      qty =
        st?.pricing_type === "per_person"
          ? guests
          : st?.pricing_type === "per_hour"
            ? num(cfg.hours ?? st?.hours, 1) * count
            : count;
      costQty = qty;
    }

    agg.set(key, {
      company_id: deal.company_id as string,
      deal_id: dealId,
      proposal_id: proposal.id as string,
      item_type: type,
      item_id: id,
      item_name: name,
      space_id: type === "space" ? id : primarySpace,
      qty,
      unit_price: unitPrice,
      line_total: line.net,
      line_gross: line.gross,
      unit_cost: unitCost,
      line_cost: unitCost * costQty,
      captured_at: now,
    });
  }

  const rows = Array.from(agg.values());
  await supabaseAdmin.from("deal_items").delete().eq("deal_id", dealId);
  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from("deal_items").insert(rows as any);
    if (error) throw new Error(error.message);
  }
  return { rows: rows.length };
}

/** Rebuild snapshots for every won deal of a company. */
export async function backfillCompanyDealItemsAdmin(companyId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("deals")
    .select("id")
    .eq("company_id", companyId)
    .in("stage", WON_STAGES as any);
  const deals = ((data as any[]) ?? []).map((d) => d.id as string);
  let rows = 0;
  let processed = 0;
  for (const id of deals) {
    try {
      const res = await snapshotDealItemsAdmin(id);
      rows += res.rows;
      processed += 1;
    } catch {
      /* skip unpriceable deals */
    }
  }
  return { deals: deals.length, processed, rows };
}
