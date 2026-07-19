import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [company, setCompany] = useState<any>(null);
  const [fees, setFees] = useState<any>(null);

  async function load() {
    const { data: c } = await supabase.from("companies").select("*").limit(1).maybeSingle();
    setCompany(c);
    if (c) {
      const { data: f } = await supabase.from("fee_config").select("*").eq("company_id", c.id).maybeSingle();
      setFees(f);
    }
  }
  useEffect(() => { load(); }, []);

  async function saveCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("companies")
      .update({
        name: fd.get("name") as string,
        primary_color: fd.get("primary_color") as string,
        currency: fd.get("currency") as string,
        logo_url: (fd.get("logo_url") as string) || null,
        require_deal_approval: fd.get("require_deal_approval") === "on",
      })
      .eq("id", company.id);
    if (error) return toast.error(error.message);
    toast.success("Brand saved");
    load();
  }


  async function saveFees(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => Number(fd.get(k) ?? 0);
    const str = (k: string) => (fd.get(k) as string) || "net";
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
        default_hours_food: num("default_hours_food"),
        default_hours_beverage: num("default_hours_beverage"),
      })

      .eq("company_id", company.id);
    if (error) return toast.error(error.message);
    toast.success("Fees saved");
    load();
  }

  if (!company) return <AppShell><div>Loading…</div></AppShell>;

  return (
    <AppShell>
      <PageHeader title="Settings" description="Brand and default fees." />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Brand</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={saveCompany}>
              <Field name="name" label="Company name" defaultValue={company.name} />
              <Field name="logo_url" label="Logo URL" defaultValue={company.logo_url ?? ""} />
              <div className="grid grid-cols-2 gap-3">
                <Field name="primary_color" label="Brand color" type="color" defaultValue={company.primary_color} />
                <Field name="currency" label="Currency" defaultValue={company.currency} />
              </div>
              <Button className="w-full">Save brand</Button>
            </form>
          </CardContent>
        </Card>
        {fees && (
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
        )}
      </div>
    </AppShell>
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

function Field(props: any) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input {...props} id={props.name} />
    </div>
  );
}
