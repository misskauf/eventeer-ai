import { useEffect, useState } from "react";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";
import { PriceBreakdown } from "@/components/price-breakdown";
import { categoryDefault, categoryDefaultHours, resolveBasis, resolveTaxRate, type CategoryDefaults } from "@/lib/tax";
import { supabase } from "@/integrations/supabase/client";
import { CategoryDefaultsBar } from "@/components/category-defaults-bar";
import { MenuSelectionEditor, type MenuGroup } from "@/components/menu-selection-editor";
import { CostMargin, costField, useCanViewCosts } from "@/lib/cost-visibility";


export function PackagesPage({ kind }: { kind: "food" | "beverage" }) {
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

  const cat = kind;
  const def = categoryDefault(defaults, cat);
  const defHours = categoryDefaultHours(defaults, kind);
  const label = kind === "food" ? "food package" : "beverage package";


  return (
    <div className="space-y-4">
      <CategoryDefaultsBar
        companyId={companyId}
        category={cat}
        defaults={defaults}
        onSaved={setDefaults}
        showHours
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
        title={label}
        table="fb_packages"
        companyId={companyId}
        filter={{ kind }}
        staticValues={{ kind }}
        sectionOrder={[
          "Basics",
          "Pricing",
          "Cost (internal)",
          ...(kind === "beverage" ? ["Event hours"] : []),
          "For how many guests",
          selectionTitle,
          "Details (optional)",
        ]}
        fields={[
          { name: "name", label: "Name", section: "Basics" },
          { name: "description", label: "Short description", type: "textarea", rows: 2, section: "Basics" },
          {
            name: "event_types",
            label: "Suits event types",
            type: "tags",
            suggestions: ["Wedding", "Corporate", "Birthday", "Conference", "Gala", "Private dining"],
            hint: "Leave empty to suit all event types. Used to suggest a draft proposal for new leads.",
            section: "Basics",
          },
          { name: "price_per_person", label: "Price per person", type: "number", step: "0.01", section: "Pricing" },
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
            section: "Pricing",
          },
          {
            name: "tax_rate_pct",
            label: "Tax rate %",
            type: "number",
            step: "0.01",
            nullable: true,
            hint: `Leave blank to use the ${cat} default (${def.rate}%).`,
            section: "Pricing",
          },
          ...(canViewCosts
            ? [
                {
                  ...costField("Internal cost per person"),
                  hint: "Not shown to clients. Same unit as the price above.",
                  section: "Cost (internal)",
                } as const,
              ]
            : []),
          ...(kind === "beverage"
            ? ([
                {
                  name: "included_hours",
                  label: "Standard hours included",
                  type: "number",
                  step: "0.5",
                  nullable: true,
                  hint: `Leave blank to use the ${cat} default (${defHours}h).`,
                  section: "Event hours",
                },
                {
                  name: "overage_price_per_person_per_hour",
                  label: "Overtime price per guest / hour",
                  type: "number",
                  step: "0.01",
                  hint: "Charged per guest for each hour beyond the standard duration. Set 0 to disable.",
                  section: "Event hours",
                },
              ] as const)
            : []),
          {
            name: "min_guests",
            label: "Minimum guests",
            type: "number",
            nullable: true,
            section: "For how many guests",
            hint: "Used to match this menu to an event's guest count.",
          },
          {
            name: "max_guests",
            label: "Maximum guests",
            type: "number",
            nullable: true,
            section: "For how many guests",
            hint: "Leave blank for no upper limit.",
          },
          {
            name: "selection_groups",
            label: "",
            type: "custom",
            section: selectionTitle,
            render: (cur: any, editing: any) => (
              <MenuSelectionEditor
                modeName="selection_mode"
                groupsName="selection_groups"
                totalName="selection_total_max"
                defaultMode={(editing?.selection_mode as any) ?? "fixed"}
                defaultGroups={(Array.isArray(cur) ? cur : []) as MenuGroup[]}
                defaultTotalMax={(editing?.selection_total_max as number | null) ?? null}
                title={selectionTitle}
                modeLabels={selectionModeLabels}
                itemNoun={itemNoun}
              />
            ),
          },
          { name: "selection_mode", label: "", type: "custom", render: () => null, defaultValue: "fixed", section: selectionTitle },
          { name: "selection_total_max", label: "", type: "custom", render: () => null, nullable: true, section: selectionTitle },
          {
            name: "long_description",
            label: "Full details",
            type: "textarea",
            rows: 6,
            hint: "Optional. Shown to the client on the proposal. Markdown supported.",
            section: "Details (optional)",
          },
          {
            name: "details_url",
            label: "Link to package details",
            type: "url",
            nullable: true,
            placeholder: "https://…",
            hint: "Optional link to a menu, PDF, or product page.",
            section: "Details (optional)",
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
                    {basis === "gross" ? "Gross" : "Net"} · Tax {rate}% · {r.included_hours ?? defHours}h included
                    {Number(r.overage_price_per_person_per_hour ?? 0) > 0 && (
                      <> · +{money(Number(r.overage_price_per_person_per_hour), currency)}/guest/h overtime</>
                    )}
                  </div>

                </div>
                <div className="text-xs text-muted-foreground">for {sampleGuests} guests</div>
              </div>
              {canViewCosts && (
                <CostMargin cost={r.cost} price={r.price_per_person} currency={currency} unit="/ guest" />
              )}
              <PriceBreakdown amount={amount} basis={basis} taxRatePct={rate} currency={currency} />
            </div>
          );
        }}
      />
    </div>
  );
}
