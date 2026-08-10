import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Field, useCompanySettings } from "@/components/settings-shared";

export const Route = createFileRoute("/_authenticated/settings/fees")({
  component: FeesSettings,
});

function FeesSettings() {
  const { company, fees, loading, reload } = useCompanySettings(true);

  async function saveFees(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => Number(fd.get(k) ?? 0);
    const str = (k: string) => (fd.get(k) as string) || "net";
    const sel = (k: string) => ((fd.get(k) as string) === "multi" ? "multi" : "single");
    const { error } = await supabase
      .from("fee_config")
      .update({
        service_charge_pct: num("service_charge_pct"),
        tax_pct: num("tax_pct"),
        cleaning_fee: num("cleaning_fee"),
        overtime_fee_per_hour: num("overtime_fee_per_hour"),
        default_basis_food: str("default_basis_food"),
        tax_rate_food: num("tax_rate_food"),
        default_basis_beverage: str("default_basis_beverage"),
        tax_rate_beverage: num("tax_rate_beverage"),
        default_basis_extra: str("default_basis_extra"),
        tax_rate_extra: num("tax_rate_extra"),
        default_basis_rental: str("default_basis_rental"),
        tax_rate_rental: num("tax_rate_rental"),
        default_basis_staff: str("default_basis_staff"),
        tax_rate_staff: num("tax_rate_staff"),
        default_hours_food: num("default_hours_food"),
        default_hours_beverage: num("default_hours_beverage"),
      })
      .eq("company_id", company.id);
    if (error) return toast.error(error.message);

    const { error: cErr } = await supabase
      .from("companies")
      .update({
        client_select_space: sel("client_select_space"),
        client_select_food: sel("client_select_food"),
        client_select_beverage: sel("client_select_beverage"),
      })
      .eq("id", company.id);
    if (cErr) return toast.error(cErr.message);

    toast.success("Fees saved");
    reload();
  }


  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!fees) return <div className="text-sm text-muted-foreground">No fee configuration found.</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Fees & tax defaults</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={saveFees}>
          <div className="grid grid-cols-2 gap-3">
            <Field name="service_charge_pct" label="Service charge %" type="number" step="0.01" defaultValue={fees.service_charge_pct} />
            <Field name="tax_pct" label="Legacy tax % (fallback)" type="number" step="0.01" defaultValue={fees.tax_pct} />
            <Field name="cleaning_fee" label="Cleaning fee" type="number" step="0.01" defaultValue={fees.cleaning_fee} />
            <Field name="overtime_fee_per_hour" label="Overtime / hour" type="number" step="0.01" defaultValue={fees.overtime_fee_per_hour} />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Category tax defaults</div>
            <p className="text-xs text-muted-foreground">Applied when an item leaves basis or tax blank.</p>
            <CategoryRow cat="food" label="Food" fees={fees} />
            <CategoryRow cat="beverage" label="Beverage" fees={fees} />
            <CategoryRow cat="extra" label="Extras" fees={fees} />
            <CategoryRow cat="rental" label="Rental / Spaces" fees={fees} />
            <CategoryRow cat="staff" label="Staffing" fees={fees} />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Client selection</div>
            <p className="text-xs text-muted-foreground">
              How many items the client can pick per category on the proposal. Multiple works like
              extras — everything the client ticks is added to the total.
            </p>
            <SelectModeRow name="client_select_space" label="Spaces" value={company?.client_select_space} />
            <SelectModeRow name="client_select_food" label="Food" value={company?.client_select_food} />
            <SelectModeRow name="client_select_beverage" label="Drinks" value={company?.client_select_beverage} />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Standard event hours</div>
            <p className="text-xs text-muted-foreground">Used when a package doesn't set its own included hours. Overtime is billed per package.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field name="default_hours_food" label="Food (hours)" type="number" step="0.5" defaultValue={fees.default_hours_food ?? 2} />
              <Field name="default_hours_beverage" label="Beverage (hours)" type="number" step="0.5" defaultValue={fees.default_hours_beverage ?? 4} />
            </div>
          </div>

          <Button className="w-full">Save fees</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CategoryRow({ cat, label, fees }: { cat: string; label: string; fees: any }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
      <div>{label}</div>
      <select
        name={`default_basis_${cat}`}
        defaultValue={fees[`default_basis_${cat}`] ?? "net"}
        className="rounded-md border bg-background px-2 py-1 text-xs"
      >
        <option value="net">Net</option>
        <option value="gross">Gross</option>
      </select>
      <div className="flex items-center gap-1">
        <Input
          name={`tax_rate_${cat}`}
          type="number"
          step="0.01"
          defaultValue={fees[`tax_rate_${cat}`] ?? 0}
          className="h-8 w-20"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}

function SelectModeRow({ name, label, value }: { name: string; label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
      <div>{label}</div>
      <select
        name={name}
        defaultValue={value === "multi" ? "multi" : "single"}
        className="rounded-md border bg-background px-2 py-1 text-xs"
      >
        <option value="single">Client selects one</option>
        <option value="multi">Client selects multiple</option>
      </select>
    </div>
  );
}
