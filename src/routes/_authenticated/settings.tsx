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
      })
      .eq("id", company.id);
    if (error) return toast.error(error.message);
    toast.success("Brand saved");
    load();
  }

  async function saveFees(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("fee_config")
      .update({
        service_charge_pct: Number(fd.get("service_charge_pct") ?? 0),
        tax_pct: Number(fd.get("tax_pct") ?? 0),
        cleaning_fee: Number(fd.get("cleaning_fee") ?? 0),
        overtime_fee_per_hour: Number(fd.get("overtime_fee_per_hour") ?? 0),
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
            <CardHeader><CardTitle>Default fees</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={saveFees}>
                <Field name="service_charge_pct" label="Service charge %" type="number" step="0.01" defaultValue={fees.service_charge_pct} />
                <Field name="tax_pct" label="Tax %" type="number" step="0.01" defaultValue={fees.tax_pct} />
                <Field name="cleaning_fee" label="Cleaning fee" type="number" step="0.01" defaultValue={fees.cleaning_fee} />
                <Field name="overtime_fee_per_hour" label="Overtime fee per hour" type="number" step="0.01" defaultValue={fees.overtime_fee_per_hour} />
                <Button className="w-full">Save fees</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
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
