import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money, type WeekdayPricing } from "@/lib/pricing";
import { PriceBreakdown } from "@/components/price-breakdown";
import { categoryDefault, resolveBasis, resolveTaxRate, type CategoryDefaults } from "@/lib/tax";
import { supabase } from "@/integrations/supabase/client";
import { CategoryDefaultsBar } from "@/components/category-defaults-bar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/catalog/spaces")({
  component: SpacesPage,
});

const WEEKDAYS = [
  { d: 0, s: "Sun" },
  { d: 1, s: "Mon" },
  { d: 2, s: "Tue" },
  { d: 3, s: "Wed" },
  { d: 4, s: "Thu" },
  { d: 5, s: "Fri" },
  { d: 6, s: "Sat" },
];

function SpacesPage() {
  const { companyId } = useCurrentCompany();
  const currency = useCompanyCurrency();
  const [defaults, setDefaults] = useState<CategoryDefaults | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("fee_config").select("*").eq("company_id", companyId).maybeSingle()
      .then(({ data }) => setDefaults(data as any));
  }, [companyId]);

  const def = categoryDefault(defaults, "rental");

  async function toggleDay(row: any, day: number) {
    const cur: number[] = row.available_days && row.available_days.length ? row.available_days : [0, 1, 2, 3, 4, 5, 6];
    const next = cur.includes(day) ? cur.filter((x) => x !== day) : [...cur, day].sort();
    const { error } = await supabase.from("spaces").update({ available_days: next }).eq("id", row.id);
    if (error) return toast.error(error.message);
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <CategoryDefaultsBar companyId={companyId} category="rental" defaults={defaults} onSaved={setDefaults} />

      <CrudList
        key={reloadKey}
        title="space"
        table="spaces"
        companyId={companyId}
        fields={[
          { name: "name", label: "Name" },
          { name: "description", label: "Short description", type: "textarea", rows: 2 },
          { name: "capacity_standing", label: "Capacity (standing)", type: "number", nullable: true },
          { name: "capacity_seated", label: "Capacity (seated)", type: "number", nullable: true },
          { name: "base_rental_fee", label: "Base rental fee", type: "number", step: "0.01" },
          { name: "min_rental_fee", label: "Minimum rental fee", type: "number", step: "0.01" },
          {
            name: "weekday_pricing",
            label: "Price per weekday",
            type: "custom",
            hint: "Optional. Overrides the default fees above for the selected day. Leave a row blank to use the defaults.",
            render: (cur, row) => (
              <WeekdayPricingEditor
                name="weekday_pricing"
                defaultValue={cur ?? row?.weekday_pricing ?? {}}
                currency={currency}
              />
            ),
          },
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
            name: "details_url",
            label: "Link to space details",
            type: "url",
            nullable: true,
            placeholder: "https://example.com/spaces/bellboy",
            hint: "Optional link shown on the deal page for quick reference.",
          },
          {
            name: "available_days",
            label: "Available days",
            type: "weekdays",
            hint: "Days of the week this space can be booked.",
          },
          {
            name: "long_description",
            label: "Full details",
            type: "textarea",
            rows: 6,
            hint: "Shown to the client on the proposal. Markdown supported.",
          },
          {
            name: "features",
            label: "Features",
            type: "tags",
            suggestions: [
              "Stage",
              "Lighting",
              "WiFi",
              "Furniture",
              "DJ Equipment",
              "PA / Sound system",
              "Microphones",
              "Projector",
              "Screen",
              "Dance floor",
              "Bar",
              "Kitchen access",
              "Outdoor area",
              "Air conditioning",
              "Heating",
              "Wheelchair accessible",
              "Parking",
              "Coat check",
              "Green room",
            ],
            hint: "Pick from suggestions or add your own.",
          },
        ]}
        render={(r: any) => {
          const amount = Math.max(Number(r.base_rental_fee), Number(r.min_rental_fee));
          const basis = resolveBasis(r, defaults, "rental");
          const rate = resolveTaxRate(r, defaults, "rental");
          const days: number[] = r.available_days && r.available_days.length ? r.available_days : [0, 1, 2, 3, 4, 5, 6];
          return (
            <div className="space-y-2">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(() => {
                    const stand = r.capacity_standing ?? null;
                    const seat = r.capacity_seated ?? null;
                    const legacy = r.capacity ?? null;
                    const capParts: string[] = [];
                    if (stand != null) capParts.push(`${stand} standing`);
                    if (seat != null) capParts.push(`${seat} seated`);
                    const capStr = capParts.length
                      ? capParts.join(" / ")
                      : legacy != null
                        ? `${legacy}`
                        : "—";
                    return `Cap ${capStr}`;
                  })()}{" "}
                  · Base {money(Number(r.base_rental_fee), currency)} · Min{" "}
                  {money(Number(r.min_rental_fee), currency)} · {basis === "gross" ? "Gross" : "Net"} · Tax {rate}%
                </div>
                {(() => {
                  const wp: WeekdayPricing | null = r.weekday_pricing ?? null;
                  if (!wp) return null;
                  const custom = WEEKDAYS.filter((w) => wp[String(w.d) as keyof WeekdayPricing]);
                  if (custom.length === 0) return null;
                  return (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Custom pricing: {custom.map((w) => w.s).join(", ")}
                    </div>
                  );
                })()}
                {r.details_url && (
                  <div className="mt-1 text-xs">
                    <a
                      href={r.details_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      View space details ↗
                    </a>
                  </div>
                )}
                {Array.isArray(r.features) && r.features.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.features.map((f: string) => (
                      <span
                        key={f}
                        className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <PriceBreakdown amount={amount} basis={basis} taxRatePct={rate} currency={currency} />
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">Available</span>
                {WEEKDAYS.map((w) => {
                  const active = days.includes(w.d);
                  return (
                    <button
                      key={w.d}
                      type="button"
                      onClick={() => toggleDay(r, w.d)}
                      className={
                        "rounded-full border px-2 py-0.5 text-[11px] transition " +
                        (active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground")
                      }
                    >
                      {w.s}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
