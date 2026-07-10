import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";
import { PriceBreakdown } from "@/components/price-breakdown";
import { categoryDefault, resolveBasis, resolveTaxRate, type CategoryDefaults } from "@/lib/tax";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/catalog/spaces")({
  component: SpacesPage,
});

function SpacesPage() {
  const { companyId } = useCurrentCompany();
  const currency = useCompanyCurrency();
  const [defaults, setDefaults] = useState<CategoryDefaults | null>(null);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("fee_config").select("*").eq("company_id", companyId).maybeSingle()
      .then(({ data }) => setDefaults(data as any));
  }, [companyId]);

  const def = categoryDefault(defaults, "rental");

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 px-4 py-2 text-sm">
        Rental default: <b>{def.basis === "gross" ? "Gross" : "Net"}</b> · Tax <b>{def.rate}%</b>
      </div>
      <CrudList
        title="space"
        table="spaces"
        companyId={companyId}
        fields={[
          { name: "name", label: "Name" },
          { name: "description", label: "Short description", type: "textarea", rows: 2 },
          { name: "capacity", label: "Capacity", type: "number", nullable: true },
          { name: "base_rental_fee", label: "Base rental fee", type: "number", step: "0.01" },
          { name: "min_rental_fee", label: "Minimum rental fee", type: "number", step: "0.01" },
          {
            name: "basis",
            label: "Price basis",
            type: "select",
            nullable: true,
            options: [
              { value: "", label: `Use rental default (${def.basis === "gross" ? "Gross" : "Net"})` },
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
            hint: `Leave blank to use the rental default (${def.rate}%).`,
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
          const amount = Math.max(Number(r.base_rental_fee), Number(r.min_rental_fee));
          const basis = resolveBasis(r, defaults, "rental");
          const rate = resolveTaxRate(r, defaults, "rental");
          return (
            <div className="space-y-2">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  Cap {r.capacity ?? "—"} · Base {money(Number(r.base_rental_fee), currency)} · Min{" "}
                  {money(Number(r.min_rental_fee), currency)} · {basis === "gross" ? "Gross" : "Net"} · Tax {rate}%
                </div>
              </div>
              <PriceBreakdown amount={amount} basis={basis} taxRatePct={rate} currency={currency} />
            </div>
          );
        }}
      />
    </div>
  );
}
