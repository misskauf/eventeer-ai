// Pure pricing engine with per-item net/tax/gross accounting.

import { categoryDefaultHours, resolveBasis, resolveTaxRate, splitNetTaxGross, type CategoryDefaults, type Category } from "./tax";

export type SpaceSel = {
  id: string;
  name: string;
  base_rental_fee: number;
  min_rental_fee: number;
  basis?: "net" | "gross" | null;
  tax_rate_pct?: number | null;
  long_description?: string | null;
};
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
  };
  category_defaults?: CategoryDefaults | null;
  season_multiplier?: number;
  min_revenue_required?: number;
  discount?: number;
};

export type Selection = {
  guest_count: number;
  space_ids: string[];
  package_ids: string[];
  extra_ids: string[];
  package_guests?: Record<string, number>; // override per package
  package_hours?: Record<string, number>; // override event hours per package
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
};

export type Totals = {
  lines: LineItem[];
  net_subtotal: number;
  tax_subtotal: number;
  gross_subtotal: number;
  subtotal: number; // = gross_subtotal (kept for back-compat)
  service_charge: number;
  tax: number; // = tax_subtotal
  discount: number;
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
): LineItem {
  const basis = resolveBasis(item, defaults, category);
  const rate = resolveTaxRate(item, defaults, category);
  const { net, tax, gross } = splitNetTaxGross(amount, basis, rate);
  return { label, qty, amount: gross, net, tax, gross, tax_rate_pct: rate, basis };
}

export function computeTotals(offer: Offer, selection: Selection): Totals {
  const mult = offer.season_multiplier ?? 1;
  const defaults = offer.category_defaults ?? null;
  const lines: LineItem[] = [];

  for (const s of offer.spaces.filter((x) => selection.space_ids.includes(x.id))) {
    const amount = Math.max(s.base_rental_fee, s.min_rental_fee) * mult;
    lines.push(lineFor(amount, s, defaults, "rental", `Space: ${s.name}`, "1"));
  }

  for (const p of offer.packages.filter((x) => selection.package_ids.includes(x.id))) {
    const guests = selection.package_guests?.[p.id] ?? selection.guest_count;
    const amount = p.price_per_person * guests * mult;
    const cat: Category = p.kind === "beverage" ? "beverage" : "food";
    lines.push(
      lineFor(
        amount,
        p,
        defaults,
        cat,
        `${p.name}`,
        `${guests} guests × ${money(p.price_per_person)}`,
      ),
    );
  }

  for (const e of offer.extras.filter((x) => selection.extra_ids.includes(x.id))) {
    let amount = 0;
    let qty = "";
    if (e.pricing_type === "per_person") {
      amount = e.price * selection.guest_count;
      qty = `${selection.guest_count} × ${money(e.price)}`;
    } else if (e.pricing_type === "per_hour") {
      const h = e.hours ?? 1;
      amount = e.price * h;
      qty = `${h}h × ${money(e.price)}`;
    } else {
      amount = e.price;
      qty = "flat";
    }
    lines.push(lineFor(amount, e, defaults, "extra", `Extra: ${e.name}`, qty));
  }

  if (offer.fees.cleaning_fee > 0) {
    lines.push(
      lineFor(offer.fees.cleaning_fee, {}, defaults, "rental", "Cleaning fee", "flat"),
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
      ),
    );
  }

  const net_subtotal = lines.reduce((a, b) => a + b.net, 0);
  const tax_subtotal = lines.reduce((a, b) => a + b.tax, 0);
  const gross_subtotal = lines.reduce((a, b) => a + b.gross, 0);

  const discount = offer.discount ?? 0;
  const afterDiscount = Math.max(0, gross_subtotal - discount);
  const service_charge = (net_subtotal * offer.fees.service_charge_pct) / 100;
  const grand_total = afterDiscount + service_charge;

  const min_required = offer.min_revenue_required ?? 0;
  const min_shortfall = Math.max(0, min_required - net_subtotal);

  return {
    lines,
    net_subtotal,
    tax_subtotal,
    gross_subtotal,
    subtotal: gross_subtotal,
    service_charge,
    tax: tax_subtotal,
    discount,
    grand_total,
    min_required,
    min_shortfall,
  };
}

export function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}
