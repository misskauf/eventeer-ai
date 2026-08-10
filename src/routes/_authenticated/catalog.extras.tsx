import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";
import { PriceBreakdown } from "@/components/price-breakdown";
import { categoryDefault, resolveBasis, resolveTaxRate, type CategoryDefaults } from "@/lib/tax";
import { supabase } from "@/integrations/supabase/client";
import { CategoryDefaultsBar } from "@/components/category-defaults-bar";
import { CostMargin, costField, useCanViewCosts } from "@/lib/cost-visibility";

export const Route = createFileRoute("/_authenticated/catalog/extras")({
  component: ExtrasPage,
});

function ExtrasPage() {
  const { companyId } = useCurrentCompany();
  const currency = useCompanyCurrency();
  const { canViewCosts } = useCanViewCosts();
  const [defaults, setDefaults] = useState<CategoryDefaults | null>(null);
  const [sampleGuests, setSampleGuests] = useState(100);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("fee_config").select("*").eq("company_id", companyId).maybeSingle()
      .then(({ data }) => setDefaults(data as any));
  }, [companyId]);

  const def = categoryDefault(defaults, "extra");

  return (
    <div className="space-y-4">
      <CategoryDefaultsBar
        companyId={companyId}
        category="extra"
        defaults={defaults}
        onSaved={setDefaults}
        rightSlot={
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
        }
      />

      <CrudList
        title="extra"
        table="extras"
        companyId={companyId}
        fields={[
          { name: "name", label: "Name" },
          { name: "description", label: "Short description", type: "textarea", rows: 2 },
          {
            name: "pricing_type",
            label: "Pricing type",
            type: "select",
            options: [
              { value: "flat", label: "Flat" },
              { value: "per_person", label: "Per person" },
              { value: "per_hour", label: "Per hour" },
            ],
          },
          { name: "price", label: "Price", type: "number", step: "0.01" },
          ...(canViewCosts ? [costField()] : []),
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
          },
          {
            name: "tax_rate_pct",
            label: "Tax rate %",
            type: "number",
            step: "0.01",
            nullable: true,
            hint: `Leave blank to use the extras default (${def.rate}%).`,
          },
          {
            name: "long_description",
            label: "Full details",
            type: "richtext",
                        hint: "Shown to the client on the proposal.",
          },
        ]}
        render={(r: any) => {
          const amount =
            r.pricing_type === "per_person" ? Number(r.price) * sampleGuests : Number(r.price);
          const basis = resolveBasis(r, defaults, "extra");
          const rate = resolveTaxRate(r, defaults, "extra");
          return (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {money(Number(r.price), currency)} · {r.pricing_type?.replace("_", " ")} ·{" "}
                    {basis === "gross" ? "Gross" : "Net"} · Tax {rate}%
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.pricing_type === "per_person" ? `for ${sampleGuests} guests` : ""}
                </div>
              </div>
              {canViewCosts && <CostMargin cost={r.cost} price={r.price} currency={currency} />}
              <PriceBreakdown amount={amount} basis={basis} taxRatePct={rate} currency={currency} />
            </div>
          );
        }}
      />
    </div>
  );
}
