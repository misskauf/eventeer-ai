import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money, type WeekdayPricing } from "@/lib/pricing";
import { resolveTaxRate, categoryDefault, type CategoryDefaults } from "@/lib/tax";
import { supabase } from "@/integrations/supabase/client";
import { CategoryDefaultsBar } from "@/components/category-defaults-bar";
import { costField, useCanViewCosts } from "@/lib/cost-visibility";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

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

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Condense a day array into ranges, e.g. [2,3,4,5,6] -> "Tue–Sat". */
export function formatAvailableDays(days: number[] | null | undefined): string {
  const list = days && days.length ? [...new Set(days)].sort((a, b) => a - b) : ALL_DAYS;
  if (list.length === 7) return "Every day";
  if (list.length === 0) return "Closed";
  const parts: string[] = [];
  let start = list[0];
  let prev = list[0];
  for (let i = 1; i <= list.length; i++) {
    const cur = list[i];
    if (cur !== prev + 1) {
      const label = WEEKDAYS[start].s;
      parts.push(start === prev ? label : `${label}–${WEEKDAYS[prev].s}`);
      start = cur;
    }
    prev = cur;
  }
  return parts.join(", ");
}

function SpacesPage() {
  const { companyId } = useCurrentCompany();
  const currency = useCompanyCurrency();
  const { canViewCosts } = useCanViewCosts();
  const [defaults, setDefaults] = useState<CategoryDefaults | null>(null);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("fee_config").select("*").eq("company_id", companyId).maybeSingle()
      .then(({ data }) => setDefaults(data as any));
  }, [companyId]);

  const def = categoryDefault(defaults, "rental");

  return (
    <div className="space-y-4">
      <CategoryDefaultsBar companyId={companyId} category="rental" defaults={defaults} onSaved={setDefaults} />

      <CrudList
        title="space"
        table="spaces"
        companyId={companyId}
        fields={[
          { name: "name", label: "Name", group: "basics" },
          { name: "description", label: "Short description", type: "textarea", rows: 2, group: "basics" },
          { name: "capacity_standing", label: "Capacity (standing)", type: "number", nullable: true, group: "basics" },
          { name: "capacity_seated", label: "Capacity (seated)", type: "number", nullable: true, group: "basics" },
          {
            name: "size",
            label: "Size",
            nullable: true,
            group: "basics",
            placeholder: "e.g. 120 m²",
          },
          {
            name: "seating_capacities",
            label: "",
            type: "custom",
            group: "basics",
            render: (cur, row) => (
              <SeatingEditor
                name="seating_capacities"
                defaultValue={(cur ?? row?.seating_capacities ?? {}) as SeatingCapacities}
              />
            ),
          },

          {
            name: "event_types",
            label: "Suits event types",
            type: "tags" as const,
            group: "basics" as const,
            suggestions: ["Wedding", "Corporate", "Birthday", "Conference", "Gala", "Private dining"],
            hint: "Leave empty to suit all event types. Used to suggest a draft proposal for new leads.",
          },

          { name: "base_rental_fee", label: "Base rental fee", type: "number", step: "0.01", group: "pricing" },
          { name: "min_rental_fee", label: "Minimum rental fee", type: "number", step: "0.01", group: "pricing" },
          ...(canViewCosts ? [{ ...costField("Internal cost per event"), group: "pricing" as const }] : []),
          {
            name: "basis",
            label: "Price basis",
            type: "select",
            nullable: true,
            group: "pricing",
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
            group: "pricing",
            hint: `Leave blank to use the rental default (${def.rate}%).`,
          },

          {
            name: "weekday_pricing",
            label: "Weekly schedule",
            type: "custom",
            group: "schedule",
            hint: "Switch off days the space cannot be booked. Fee overrides replace the default base and minimum fees for that day.",
            render: (cur, row) => (
              <ScheduleEditor
                pricingName="weekday_pricing"
                daysName="available_days"
                defaultPricing={(cur ?? row?.weekday_pricing ?? {}) as WeekdayPricing}
                defaultDays={(row?.available_days as number[] | null) ?? null}
                currency={currency}
              />
            ),
          },
          // Value is written by ScheduleEditor's hidden input; nothing to render.
          { name: "available_days", label: "", type: "custom", group: "schedule", render: () => null },

          {
            name: "long_description",
            label: "Full details",
            type: "textarea",
            rows: 6,
            group: "client",
            hint: "Shown to the client on the proposal. Markdown supported.",
          },
          {
            name: "features",
            label: "Features",
            type: "tags",
            group: "client",
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
          {
            name: "details_url",
            label: "Link to space details",
            type: "url",
            nullable: true,
            group: "client",
            placeholder: "https://example.com/spaces/bellboy",
            hint: "Optional link shown on the deal page for quick reference.",
          },
        ]}
        columns={[
          {
            key: "name",
            label: "Space",
            cell: (r: any) => (
              <div className="min-w-0">
                <div className="font-medium">{r.name}</div>
                {r.description && (
                  <div className="max-w-[28rem] truncate text-xs text-muted-foreground">{r.description}</div>
                )}
              </div>
            ),
          },
          {
            key: "capacity",
            label: "Capacity",
            cell: (r: any) => {
              const parts: string[] = [];
              if (r.capacity_standing != null) parts.push(`${r.capacity_standing} standing`);
              if (r.capacity_seated != null) parts.push(`${r.capacity_seated} seated`);
              const legacy = r.capacity ?? null;
              return (
                <span className="text-muted-foreground">
                  {parts.length ? parts.join(" / ") : legacy != null ? String(legacy) : "—"}
                </span>
              );
            },
          },
          {
            key: "base",
            label: "Base",
            align: "right",
            cell: (r: any) => money(Number(r.base_rental_fee ?? 0), currency),
          },
          {
            key: "min",
            label: "Min",
            align: "right",
            cell: (r: any) => (
              <span className="text-muted-foreground">{money(Number(r.min_rental_fee ?? 0), currency)}</span>
            ),
          },
          {
            key: "days",
            label: "Days",
            cell: (r: any) => <span className="text-muted-foreground">{formatAvailableDays(r.available_days)}</span>,
          },
          {
            key: "tax",
            label: "Tax",
            align: "right",
            cell: (r: any) => (
              <span className="text-muted-foreground">{resolveTaxRate(r, defaults, "rental")}%</span>
            ),
          },
        ]}
        render={(r: any) => <div className="font-medium">{r.name}</div>}
      />
    </div>
  );
}

function ScheduleEditor({
  pricingName,
  daysName,
  defaultPricing,
  defaultDays,
  currency,
}: {
  pricingName: string;
  daysName: string;
  defaultPricing: WeekdayPricing;
  defaultDays: number[] | null;
  currency: string;
}) {
  const [days, setDays] = useState<number[]>(defaultDays && defaultDays.length ? [...defaultDays].sort() : ALL_DAYS);
  const [val, setVal] = useState<WeekdayPricing>(defaultPricing ?? {});

  function toggleDay(day: number, on: boolean) {
    setDays((prev) => (on ? [...new Set([...prev, day])].sort((a, b) => a - b) : prev.filter((d) => d !== day)));
  }

  function update(day: number, field: "base" | "min", raw: string) {
    const key = String(day) as keyof WeekdayPricing;
    setVal((prev) => {
      const next: WeekdayPricing = { ...prev };
      const row = { ...(next[key] ?? {}) };
      if (raw === "") delete (row as any)[field];
      else (row as any)[field] = Number(raw);
      if (row.base == null && row.min == null) delete next[key];
      else next[key] = row;
      return next;
    });
  }

  // Overrides for closed days are stripped before submit.
  const submitted: WeekdayPricing = Object.fromEntries(
    Object.entries(val).filter(([k]) => days.includes(Number(k))),
  ) as WeekdayPricing;

  const sym = (() => {
    try {
      return (0).toLocaleString("en-US", { style: "currency", currency }).replace(/[\d.,\s]/g, "");
    } catch {
      return currency;
    }
  })();

  return (
    <div className="space-y-1.5">
      <input type="hidden" name={pricingName} value={JSON.stringify(submitted)} />
      <input type="hidden" name={daysName} value={JSON.stringify(days)} />
      <div className="grid grid-cols-[auto_auto_1fr_1fr] items-center gap-2 text-xs">
        <div />
        <div className="text-muted-foreground">Open</div>
        <div className="text-muted-foreground">Base fee ({sym})</div>
        <div className="text-muted-foreground">Min fee ({sym})</div>
        {WEEKDAYS.map((w) => {
          const key = String(w.d) as keyof WeekdayPricing;
          const row = val[key] ?? {};
          const open = days.includes(w.d);
          return (
            <React.Fragment key={w.d}>
              <div className={`flex items-center text-sm ${open ? "" : "text-muted-foreground"}`}>{w.s}</div>
              <div className="flex items-center">
                <Switch
                  checked={open}
                  onCheckedChange={(v) => toggleDay(w.d, v)}
                  aria-label={`${w.s} available`}
                />
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder="default"
                disabled={!open}
                className={open ? "" : "opacity-50"}
                defaultValue={row.base ?? ""}
                onChange={(e) => update(w.d, "base", e.target.value)}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="default"
                disabled={!open}
                className={open ? "" : "opacity-50"}
                defaultValue={row.min ?? ""}
                onChange={(e) => update(w.d, "min", e.target.value)}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
