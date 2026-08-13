import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Field, useCompanySettings } from "@/components/settings-shared";
import { Label } from "@/components/ui/label";
import { CurrencySelect } from "@/components/currency-select";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { usePermissions } from "@/lib/use-permissions";
import { exportCompanyData } from "@/lib/data-export.functions";
import { downloadExportZip } from "@/lib/data-export";


export const Route = createFileRoute("/_authenticated/settings/company")({
  component: CompanySettings,
});

function CompanySettings() {
  const { company, loading, reload } = useCompanySettings();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("companies")
      .update({
        name: fd.get("name") as string,
        currency: fd.get("currency") as string,
        address: (fd.get("address") as string) || null,
        contact_email: (fd.get("contact_email") as string) || null,
        contact_phone: (fd.get("contact_phone") as string) || null,
        website: (fd.get("website") as string) || null,
      } as any)
      .eq("id", company.id);
    if (error) return toast.error(error.message);
    toast.success("Company saved");
    reload();
  }

  if (loading || !company) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Company</CardTitle>
        <p className="text-sm text-muted-foreground">
          Used by the {`{{company_address}}`}, {`{{company_email}}`}, {`{{company_phone}}`} and{" "}
          {`{{company_website}}`} placeholders in contract templates.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={save}>
          <Field name="name" label="Company name" defaultValue={company.name} />
          <Field name="address" label="Address" defaultValue={company.address ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <Field name="contact_email" label="Contact email" type="email" defaultValue={company.contact_email ?? ""} />
            <Field name="contact_phone" label="Contact phone" defaultValue={company.contact_phone ?? ""} />
          </div>
          <Field name="website" label="Website" defaultValue={company.website ?? ""} />
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <CurrencySelect id="currency" name="currency" defaultCode={company.currency} />
          </div>

          <Button className="w-full">Save company</Button>
        </form>
      </CardContent>
    </Card>
    <DataExportCard />
    </div>
  );
}

function DataExportCard() {
  const { t } = useTranslation();
  const { isOwner, loading } = usePermissions();
  const [busy, setBusy] = useState(false);

  if (loading || !isOwner) return null;

  async function run() {
    setBusy(true);
    try {
      const payload = await exportCompanyData();
      await downloadExportZip(payload as any);
      toast.success(t("settings.export_done"));
    } catch (e: any) {
      toast.error(e?.message ?? t("settings.export_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.export_title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("settings.export_hint")}</p>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={run} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? t("settings.export_running") : t("settings.export_button")}
        </Button>
      </CardContent>
    </Card>
  );
}
