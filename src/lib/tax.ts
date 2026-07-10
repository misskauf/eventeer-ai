// Net / Tax / Gross helpers. Item-level basis/rate override category defaults.

export type Basis = "net" | "gross";
export type Category = "food" | "beverage" | "extra" | "rental";

export type CategoryDefaults = {
  default_basis_food?: Basis;
  tax_rate_food?: number;
  default_basis_beverage?: Basis;
  tax_rate_beverage?: number;
  default_basis_extra?: Basis;
  tax_rate_extra?: number;
  default_basis_rental?: Basis;
  tax_rate_rental?: number;
};

export type TaxedItem = {
  basis?: Basis | null;
  tax_rate_pct?: number | null;
};

export function categoryDefault(
  defaults: CategoryDefaults | null | undefined,
  category: Category,
): { basis: Basis; rate: number } {
  const d = defaults ?? {};
  const basis = (d[`default_basis_${category}` as keyof CategoryDefaults] as Basis) ?? "net";
  const rate = Number(d[`tax_rate_${category}` as keyof CategoryDefaults] ?? 0);
  return { basis, rate };
}

export function resolveBasis(item: TaxedItem, defaults: CategoryDefaults | null | undefined, category: Category): Basis {
  return (item.basis ?? categoryDefault(defaults, category).basis) as Basis;
}

export function resolveTaxRate(item: TaxedItem, defaults: CategoryDefaults | null | undefined, category: Category): number {
  return item.tax_rate_pct != null ? Number(item.tax_rate_pct) : categoryDefault(defaults, category).rate;
}

// Given a monetary amount interpreted according to `basis`, return net/tax/gross.
export function splitNetTaxGross(amount: number, basis: Basis, taxRatePct: number) {
  const r = Number(taxRatePct) / 100;
  if (basis === "gross") {
    const net = r > -1 ? amount / (1 + r) : amount;
    const tax = amount - net;
    return { net, tax, gross: amount };
  }
  const tax = amount * r;
  return { net: amount, tax, gross: amount + tax };
}
