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

export const Route = createFileRoute("/_authenticated/catalog/staff")({
  component: StaffPage,
});

function StaffPage() {
  const { companyId } = useCurrentCompany();
  const currency = useCompanyCurrency();
  const [defaults, setDefaults] = useState<CategoryDefaults | null>(null);
  const [sampleGuests, setSampleGuests] = useState(100);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("fee_config").select("*").eq("company_id", companyId).maybeSingle()
      .then(({ data }) => setDefaults(data as any));
  }, [companyId]);

  const def = categoryDefault(defaults, "staff");

  return (
    <div className="space-y-4">
      <CategoryDefaultsBar
        companyId={companyId}
        category="staff"
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
        title="staff role"
        table="staff_roles"
        companyId={companyId}
        fields={[
          { name: "name", label: "Role name" },
          { name: "name_de", label: "Role name (Deutsch)", nullable: true },
          { name: "description", label: "Short description", type: "textarea", rows: 2 },
          {
            name: "pricing_type",
            label: "Pricing type",
            type: "select",
            options: [
              { value: "per_hour", label: "Per hour" },
              { value: "flat", label: "Flat" },
              { value: "per_person", label: "Per person" },
            ],
          },
          { name: "price", label: "Price", type: "number", step: "0.01" },
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
            hint: `Leave blank to use the staffing default (${def.rate}%).`,
          },
          {
            name: "long_description",
            label: "Full details",
            type: "textarea",
            rows: 6,
            hint: "Shown to the client on the proposal. Markdown supported.",
          },
          {
            name: "long_description_de",
            label: "Full details (Deutsch)",
            type: "textarea",
            rows: 6,
            nullable: true,
            hint: "Used when the deal language is German. Falls back to the English text.",
          },
        ]}
        render={(r: any) => {
          const amount =
            r.pricing_type === "per_person" ? Number(r.price) * sampleGuests : Number(r.price);
          const basis = resolveBasis(r, defaults, "staff");
          const rate = resolveTaxRate(r, defaults, "staff");
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
              <PriceBreakdown amount={amount} basis={basis} taxRatePct={rate} currency={currency} />
            </div>
          );
        }}
      />
    </div>
  );
}
