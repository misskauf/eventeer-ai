// Pure pricing engine with per-item net/tax/gross accounting.

import { categoryDefaultHours, resolveBasis, resolveTaxRate, splitNetTaxGross, type CategoryDefaults, type Category } from "./tax";

export type WeekdayPricing = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", { base?: number | null; min?: number | null }>>;

export type SpaceSel = {
  id: string;
  name: string;
  base_rental_fee: number;
  min_rental_fee: number;
  basis?: "net" | "gross" | null;
  tax_rate_pct?: number | null;
  long_description?: string | null;
  weekday_pricing?: WeekdayPricing | null;
};

export function resolveSpaceFees(
  space: Pick<SpaceSel, "base_rental_fee" | "min_rental_fee" | "weekday_pricing">,
  eventDate?: string | null,
): { base: number; min: number; overridden: boolean } {
  const base0 = Number(space.base_rental_fee ?? 0);
  const min0 = Number(space.min_rental_fee ?? 0);
  if (!eventDate || !space.weekday_pricing) return { base: base0, min: min0, overridden: false };
  const d = new Date(eventDate);
  if (isNaN(d.getTime())) return { base: base0, min: min0, overridden: false };
  const key = String(d.getUTCDay()) as keyof WeekdayPricing;
  const wd = space.weekday_pricing[key];
  if (!wd) return { base: base0, min: min0, overridden: false };
  const base = wd.base != null && wd.base !== undefined ? Number(wd.base) : base0;
  const min = wd.min != null && wd.min !== undefined ? Number(wd.min) : min0;
  return { base, min, overridden: true };
}
export type PackageSel = {
  id: string;
  name: string;
  price_per_person: number;
  kind?: "food" | "beverage" | null;
  basis?: "net" | "gross" | null;
  tax_rate_pct?: number | null;
  long_description?: string | null;
  included_hours?: number | null;
  overage_price_per_person_per_hour?: number | null;
  selection_mode?: "fixed" | "single_group" | "multi_group" | null;
  selection_groups?: { label: string; max_select: number; options: { label: string; description?: string }[] }[] | null;
  selection_total_max?: number | null;
  details_url?: string | null;
};

export type ExtraSel = {
  id: string;
  name: string;
  pricing_type: "per_person" | "flat" | "per_hour";
  price: number;
  hours?: number;
  basis?: "net" | "gross" | null;
  tax_rate_pct?: number | null;
  long_description?: string | null;
};

export type DiscountTarget = {
  kind: "space" | "package" | "extra";
  id: string;
};

export type Offer = {
  spaces: SpaceSel[];
  packages: PackageSel[];
  extras: ExtraSel[];
  fees: {
    service_charge_pct: number;
    tax_pct: number; // legacy fallback if a category default is 0
    cleaning_fee: number;
    overtime_fee_per_hour: number;
    overtime_hours?: number;
    gratuity_type?: "service_charge" | "tip";
    gratuity_tax_rate_pct?: number;
  };
  category_defaults?: CategoryDefaults | null;
  season_multiplier?: number;
  min_revenue_required?: number;
  discount?: number;
  discount_target?: DiscountTarget | null;
  currency?: string;
};


export type Selection = {
  guest_count: number;
  space_ids: string[];
  package_ids: string[];
  extra_ids: string[];
  package_guests?: Record<string, number>; // override per package
  package_hours?: Record<string, number>; // override event hours per package
  event_date?: string | null; // ISO date, used for weekday-based pricing
};


export type LineItem = {
  label: string;
  qty: string;
  amount: number; // gross for display
  net: number;
  tax: number;
  gross: number;
  tax_rate_pct: number;
  basis: "net" | "gross";
  sourceKind?: "space" | "package" | "extra" | "package_overtime" | "fee";
  sourceId?: string;
  original_gross?: number;
  original_net?: number;
  original_tax?: number;
  discount_applied?: number; // gross discount taken from this line
};

export type Totals = {
  lines: LineItem[];
  net_subtotal: number;
  tax_subtotal: number;
  gross_subtotal: number;
  subtotal: number; // = gross_subtotal (kept for back-compat)
  service_charge: number; // gross gratuity (back-compat)
  gratuity_net: number;
  gratuity_tax: number;
  gratuity_gross: number;
  gratuity_label: string;
  gratuity_type: "service_charge" | "tip";
  tax: number; // = tax_subtotal
  discount: number; // gross discount applied (from a targeted line, or legacy flat)
  discount_net: number; // net-equivalent discount, for display below net subtotal
  discount_targeted: boolean;
  grand_total: number;
  min_required: number;
  min_shortfall: number;
};


function lineFor(
  amount: number,
  item: { basis?: "net" | "gross" | null; tax_rate_pct?: number | null },
  defaults: CategoryDefaults | null | undefined,
  category: Category,
  label: string,
  qty: string,
  sourceKind?: LineItem["sourceKind"],
  sourceId?: string,
): LineItem {
  const basis = resolveBasis(item, defaults, category);
  const rate = resolveTaxRate(item, defaults, category);
  const { net, tax, gross } = splitNetTaxGross(amount, basis, rate);
  return { label, qty, amount: gross, net, tax, gross, tax_rate_pct: rate, basis, sourceKind, sourceId };
}

export function computeTotals(offer: Offer, selection: Selection): Totals {
  const mult = offer.season_multiplier ?? 1;
  const defaults = offer.category_defaults ?? null;
  const cur = offer.currency ?? "USD";
  const lines: LineItem[] = [];

  for (const s of offer.spaces.filter((x) => selection.space_ids.includes(x.id))) {
    const fees = resolveSpaceFees(s, selection.event_date);
    const amount = Math.max(fees.base, fees.min) * mult;
    lines.push(lineFor(amount, s, defaults, "rental", `Space: ${s.name}`, "1", "space", s.id));
  }

  for (const p of offer.packages.filter((x) => selection.package_ids.includes(x.id))) {
    const guests = selection.package_guests?.[p.id] ?? selection.guest_count;
    const cat: Category = p.kind === "beverage" ? "beverage" : "food";
    const standardHours = p.included_hours != null ? Number(p.included_hours) : categoryDefaultHours(defaults, cat);
    const hours = selection.package_hours?.[p.id] ?? standardHours;
    const amount = p.price_per_person * guests * mult;
    lines.push(
      lineFor(
        amount,
        p,
        defaults,
        cat,
        `${p.name}`,
        `${guests} guests × ${money(p.price_per_person, cur)} · ${standardHours}h included`,
        "package",
        p.id,
      ),
    );
    const overageRate = Number(p.overage_price_per_person_per_hour ?? 0);
    const extraHours = Math.max(0, hours - standardHours);
    if (overageRate > 0 && extraHours > 0) {
      const overAmount = overageRate * extraHours * guests * mult;
      lines.push(
        lineFor(
          overAmount,
          p,
          defaults,
          cat,
          `${p.name} — overtime`,
          `${extraHours}h × ${guests} guests × ${money(overageRate, cur)}`,
          "package_overtime",
          p.id,
        ),
      );
    }
  }


  for (const e of offer.extras.filter((x) => selection.extra_ids.includes(x.id))) {
    let amount = 0;
    let qty = "";
    if (e.pricing_type === "per_person") {
      amount = e.price * selection.guest_count;
      qty = `${selection.guest_count} × ${money(e.price, cur)}`;
    } else if (e.pricing_type === "per_hour") {
      const h = e.hours ?? 1;
      amount = e.price * h;
      qty = `${h}h × ${money(e.price, cur)}`;
    } else {
      amount = e.price;
      qty = "flat";
    }
    lines.push(lineFor(amount, e, defaults, "extra", `Extra: ${e.name}`, qty, "extra", e.id));
  }

  if (offer.fees.cleaning_fee > 0) {
    lines.push(
      lineFor(offer.fees.cleaning_fee, {}, defaults, "rental", "Cleaning fee", "flat", "fee"),
    );
  }
  if (offer.fees.overtime_hours && offer.fees.overtime_fee_per_hour > 0) {
    lines.push(
      lineFor(
        offer.fees.overtime_hours * offer.fees.overtime_fee_per_hour,
        {},
        defaults,
        "rental",
        "Overtime",
        `${offer.fees.overtime_hours}h`,
        "fee",
      ),
    );
  }

  // Apply targeted discount inside a specific line (gross), re-derive its net/tax.
  const rawDiscount = Number(offer.discount ?? 0);
  const target = offer.discount_target ?? null;
  let discount_applied_gross = 0;
  let discount_net = 0;
  let discount_targeted = false;

  if (rawDiscount > 0 && target) {
    const idx = lines.findIndex(
      (l) => l.sourceKind === target.kind && l.sourceId === target.id,
    );
    if (idx >= 0) {
      discount_targeted = true;
      const line = lines[idx];
      const origGross = line.gross;
      const origNet = line.net;
      const origTax = line.tax;
      const applied = Math.min(rawDiscount, origGross);
      const newGross = origGross - applied;
      // Re-derive net/tax from the line's own tax rate, treating adjusted amount as gross.
      const { net: newNet, tax: newTax } = splitNetTaxGross(newGross, "gross", line.tax_rate_pct);
      lines[idx] = {
        ...line,
        gross: newGross,
        amount: newGross,
        net: newNet,
        tax: newTax,
        original_gross: origGross,
        original_net: origNet,
        original_tax: origTax,
        discount_applied: applied,
      };
      discount_applied_gross = applied;
      discount_net = origNet - newNet;
    }
  }

  const net_subtotal = lines.reduce((a, b) => a + b.net, 0);
  const tax_subtotal = lines.reduce((a, b) => a + b.tax, 0);
  const gross_subtotal = lines.reduce((a, b) => a + b.gross, 0);

  // Legacy fallback: discount set with no target → flat gross deduction from grand total.
  const legacyFlatDiscount = rawDiscount > 0 && !discount_targeted ? rawDiscount : 0;
  const afterDiscount = Math.max(0, gross_subtotal - legacyFlatDiscount);

  const gratuity_type: "service_charge" | "tip" = offer.fees.gratuity_type ?? "service_charge";
  const gratuity_pct = Number(offer.fees.service_charge_pct ?? 0);
  const gratuity_tax_rate =
    gratuity_type === "tip" ? 0 : Number(offer.fees.gratuity_tax_rate_pct ?? 0);
  const gratuity_net = (net_subtotal * gratuity_pct) / 100;
  const gratuity_tax = gratuity_net * (gratuity_tax_rate / 100);
  const gratuity_gross = gratuity_net + gratuity_tax;
  const gratuity_label = gratuity_type === "tip" ? "Tip" : "Service charge";

  const grand_total = afterDiscount + gratuity_gross;
  const combined_tax = tax_subtotal + gratuity_tax;

  const min_required = offer.min_revenue_required ?? 0;
  const min_shortfall = Math.max(0, min_required - net_subtotal);

  return {
    lines,
    net_subtotal,
    tax_subtotal: combined_tax,
    gross_subtotal,
    subtotal: gross_subtotal,
    service_charge: gratuity_gross,
    gratuity_net,
    gratuity_tax,
    gratuity_gross,
    gratuity_label,
    gratuity_type,
    tax: combined_tax,
    discount: discount_targeted ? discount_applied_gross : legacyFlatDiscount,
    discount_net: discount_targeted ? discount_net : 0,
    discount_targeted,
    grand_total,
    min_required,
    min_shortfall,
  };

}

export function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

