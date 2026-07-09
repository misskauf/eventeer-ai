// Pure pricing engine. Used on both manager builder and client proposal view.

export type SpaceSel = { id: string; name: string; base_rental_fee: number; min_rental_fee: number };
export type PackageSel = { id: string; name: string; price_per_person: number };
export type ExtraSel = {
  id: string;
  name: string;
  pricing_type: "per_person" | "flat" | "per_hour";
  price: number;
  hours?: number;
};

export type Offer = {
  spaces: SpaceSel[];
  packages: PackageSel[];
  extras: ExtraSel[];
  fees: {
    service_charge_pct: number;
    tax_pct: number;
    cleaning_fee: number;
    overtime_fee_per_hour: number;
    overtime_hours?: number;
  };
  season_multiplier?: number;
  min_revenue_required?: number;
  discount?: number;
};

export type Selection = {
  guest_count: number;
  space_ids: string[];
  package_ids: string[];
  extra_ids: string[];
};

export type LineItem = { label: string; qty: string; amount: number };
export type Totals = {
  lines: LineItem[];
  subtotal: number;
  service_charge: number;
  tax: number;
  discount: number;
  grand_total: number;
  min_required: number;
  min_shortfall: number;
};

export function computeTotals(offer: Offer, selection: Selection): Totals {
  const mult = offer.season_multiplier ?? 1;
  const lines: LineItem[] = [];

  for (const s of offer.spaces.filter((x) => selection.space_ids.includes(x.id))) {
    const amount = Math.max(s.base_rental_fee, s.min_rental_fee) * mult;
    lines.push({ label: `Space: ${s.name}`, qty: "1", amount });
  }

  for (const p of offer.packages.filter((x) => selection.package_ids.includes(x.id))) {
    const amount = p.price_per_person * selection.guest_count * mult;
    lines.push({
      label: `${p.name}`,
      qty: `${selection.guest_count} guests × ${money(p.price_per_person)}`,
      amount,
    });
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
    lines.push({ label: `Extra: ${e.name}`, qty, amount });
  }

  if (offer.fees.cleaning_fee > 0) {
    lines.push({ label: "Cleaning fee", qty: "flat", amount: offer.fees.cleaning_fee });
  }
  if (offer.fees.overtime_hours && offer.fees.overtime_fee_per_hour > 0) {
    lines.push({
      label: "Overtime",
      qty: `${offer.fees.overtime_hours}h`,
      amount: offer.fees.overtime_hours * offer.fees.overtime_fee_per_hour,
    });
  }

  const subtotal = lines.reduce((a, b) => a + b.amount, 0);
  const discount = offer.discount ?? 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const service_charge = afterDiscount * (offer.fees.service_charge_pct / 100);
  const tax = (afterDiscount + service_charge) * (offer.fees.tax_pct / 100);
  const grand_total = afterDiscount + service_charge + tax;

  const min_required = offer.min_revenue_required ?? 0;
  const min_shortfall = Math.max(0, min_required - subtotal);

  return {
    lines,
    subtotal,
    service_charge,
    tax,
    discount,
    grand_total,
    min_required,
    min_shortfall,
  };
}

export function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}
