// Server-only: builds a suggested DRAFT proposal for a freshly created lead.
// Never sends anything to the client — the manager always reviews first.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pickMinRevRule, type MinRevRule } from "@/lib/date-format";

export type SuggestDealInput = {
  id: string;
  company_id: string;
  guest_count: number | null;
  event_type: string | null;
  event_date: string | null;
};

function matchesEventType(tags: unknown, eventType: string | null): boolean {
  const list = Array.isArray(tags) ? (tags as string[]) : [];
  if (list.length === 0) return true;
  if (!eventType) return false;
  const needle = eventType.trim().toLowerCase();
  if (!needle) return false;
  return list.some((t) => String(t).trim().toLowerCase() === needle);
}

function isTagged(tags: unknown): boolean {
  return Array.isArray(tags) && tags.length > 0;
}

/**
 * Picks a best-fit space + food/beverage package and stores a draft proposal.
 * Returns whether a draft was created. Never throws.
 */
export async function buildSuggestedProposal(
  companyId: string,
  deal: SuggestDealInput,
): Promise<{ created: boolean }> {
  const guests = Number(deal.guest_count ?? 0) || 0;
  const eventType = deal.event_type ?? null;

  const [{ data: spacesRaw }, { data: packagesRaw }, { data: feeRow }, { data: rulesRaw }] =
    await Promise.all([
      supabaseAdmin
        .from("spaces")
        .select("id, name, capacity, capacity_seated, capacity_standing, event_types, active")
        .eq("company_id", companyId)
        .eq("active", true),
      supabaseAdmin
        .from("fb_packages")
        .select("id, name, kind, min_guests, event_types, active, updated_at")
        .eq("company_id", companyId)
        .eq("active", true),
      supabaseAdmin.from("fee_config").select("*").eq("company_id", companyId).maybeSingle(),
      supabaseAdmin
        .from("pricing_rules")
        .select("id, notes, days_of_week, months, space_ids, min_revenue, basis")
        .eq("company_id", companyId),
    ]);

  const spaces = (spacesRaw ?? []) as any[];
  const packages = (packagesRaw ?? []) as any[];

  // --- Space: smallest capacity that fits; else the largest. Tagged match wins ties.
  const capOf = (s: any) =>
    Number(s.capacity ?? 0) ||
    Number(s.capacity_seated ?? 0) ||
    Number(s.capacity_standing ?? 0) ||
    0;
  let space: any = null;
  if (spaces.length) {
    const scored = [...spaces].sort((a, b) => {
      const tagDiff =
        Number(matchesEventType(b.event_types, eventType) && isTagged(b.event_types)) -
        Number(matchesEventType(a.event_types, eventType) && isTagged(a.event_types));
      if (tagDiff !== 0) return tagDiff;
      return capOf(a) - capOf(b);
    });
    space = scored.find((s) => guests <= 0 || capOf(s) >= guests) ?? null;
    if (!space) space = [...spaces].sort((a, b) => capOf(b) - capOf(a))[0] ?? null;
  }

  // --- Packages: min_guests fits + event-type match; tagged match preferred.
  function pickPackage(kind: "food" | "beverage"): any | null {
    const candidates = packages.filter(
      (p) =>
        (p.kind ?? "food") === kind &&
        (guests <= 0 || Number(p.min_guests ?? 0) <= guests) &&
        matchesEventType(p.event_types, eventType),
    );
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const tagDiff = Number(isTagged(b.event_types)) - Number(isTagged(a.event_types));
      if (tagDiff !== 0) return tagDiff;
      return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
    });
    return candidates[0];
  }

  const food = pickPackage("food");
  const beverage = pickPackage("beverage");

  const packageIds = [food?.id, beverage?.id].filter(Boolean) as string[];
  if (!space && packageIds.length === 0) return { created: false };

  const spaceIds = space ? [space.id as string] : [];
  const packageGuests: Record<string, number> = {};
  for (const pid of packageIds) packageGuests[pid] = guests;

  const gratDefault =
    (feeRow as any)?.gratuity_mode === "fixed"
      ? Number((feeRow as any)?.gratuity_fixed_pct ?? 0)
      : Number((feeRow as any)?.gratuity_default_pct ?? (feeRow as any)?.service_charge_pct ?? 0);

  const matchedRule = pickMinRevRule((rulesRaw ?? []) as MinRevRule[], deal.event_date, spaceIds);

  const offer = {
    space_ids: spaceIds,
    package_ids: packageIds,
    extra_ids: [] as string[],
    staff_ids: [] as string[],
    staff_config: {},
    package_guests: packageGuests,
    package_hours: {},
    season_id: "none",
    discount: 0,
    discount_target: null,
    min_revenue_required: Number(matchedRule?.min_revenue ?? 0),
    service_charge_pct_override: gratDefault,
    guest_count: guests,
    cover_title: "",
    alternative_groups: [] as unknown[],
    menu_selection_mode_by_pkg: {},
    menu_choices_by_pkg: {},
  };

  const { error: propErr } = await supabaseAdmin.from("proposals").insert({
    deal_id: deal.id,
    company_id: companyId,
    version: 1,
    status: "draft",
    offer: offer as any,
    constraints: { intro_markdown: "", autodrafted: true } as any,
  } as any);
  if (propErr) {
    console.warn("[buildSuggestedProposal] proposal insert failed", propErr.message);
    return { created: false };
  }

  await supabaseAdmin.from("deals").update({ stage: "proposal_draft" } as any).eq("id", deal.id);

  await supabaseAdmin.from("deal_activities").insert({
    deal_id: deal.id,
    company_id: companyId,
    kind: "lead_autodrafted",
    meta: { space_id: space?.id ?? null, package_ids: packageIds } as any,
  } as any);

  return { created: true };
}
