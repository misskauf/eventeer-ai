import { useEffect, useState } from "react";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";
import { PriceBreakdown } from "@/components/price-breakdown";
import { categoryDefault, categoryDefaultHours, resolveBasis, resolveTaxRate, type CategoryDefaults } from "@/lib/tax";
import { supabase } from "@/integrations/supabase/client";


export function PackagesPage({ kind }: { kind: "food" | "beverage" }) {
  const { companyId } = useCurrentCompany();
  const currency = useCompanyCurrency();
  const [defaults, setDefaults] = useState<CategoryDefaults | null>(null);
  const [sampleGuests, setSampleGuests] = useState(100);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("fee_config").select("*").eq("company_id", companyId).maybeSingle()
      .then(({ data }) => setDefaults(data as any));
  }, [companyId]);

  const cat = kind;
  const def = categoryDefault(defaults, cat);
  const defHours = categoryDefaultHours(defaults, kind);
  const label = kind === "food" ? "food package" : "beverage package";


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-2 text-sm">
        <div>
          Category default: <b>{def.basis === "gross" ? "Gross" : "Net"}</b> · Tax <b>{def.rate}%</b> · Standard <b>{defHours}h</b>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-muted-foreground">Preview guests</label>
          <input
            type="number"
            min={1}
            value={sampleGuests}
            onChange={(e) => setSampleGuests(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-md border bg-background px-2 py-1 text-sm"
          />
        </div>
      </div>
      <CrudList
        title={label}
        table="fb_packages"
        companyId={companyId}
        filter={{ kind }}
        staticValues={{ kind }}
        fields={[
          { name: "name", label: "Name" },
          { name: "description", label: "Short description", type: "textarea", rows: 2 },
          { name: "price_per_person", label: "Price per person", type: "number", step: "0.01" },
          { name: "min_guests", label: "Minimum guests", type: "number", nullable: true },
          {
            name: "basis",
            label: "Price basis",
            type: "select",
            nullable: true,
            options: [
              { value: "", label: `Use category default (${def.basis === "gross" ? "Gross" : "Net"})` },
              { value: "net", label: "Net (tax added on top)" },
              { value: "gross", label: "Gross (tax included)" },
            ],
            hint: "Choose whether the price above is entered net or gross.",
          },
          {
            name: "tax_rate_pct",
            label: "Tax rate %",
            type: "number",
            step: "0.01",
            nullable: true,
            hint: `Leave blank to use the ${cat} default (${def.rate}%).`,
          },
          {
            name: "included_hours",
            label: "Standard hours included",
            type: "number",
            step: "0.5",
            nullable: true,
            hint: `Leave blank to use the ${cat} default (${defHours}h).`,
          },
          {
            name: "overage_price_per_person_per_hour",
            label: "Overtime price per guest / hour",
            type: "number",
            step: "0.01",
            hint: "Charged per guest for each hour beyond the standard duration. Set 0 to disable.",
          },
          {
            name: "long_description",
            label: "Full details",
            type: "textarea",
            rows: 6,
            hint: "Shown to the client on the proposal. Markdown supported.",
          },
        ]}

        render={(r: any) => {
          const amount = Number(r.price_per_person) * sampleGuests;
          const basis = resolveBasis(r, defaults, cat);
          const rate = resolveTaxRate(r, defaults, cat);
          return (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {money(Number(r.price_per_person), currency)} / guest · min {r.min_guests ?? 0} ·{" "}
                    {basis === "gross" ? "Gross" : "Net"} · Tax {rate}%
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">for {sampleGuests} guests</div>
              </div>
              <PriceBreakdown amount={amount} basis={basis} taxRatePct={rate} currency={currency} />
            </div>
          );
        }}
      />
    </div>
  );
}
