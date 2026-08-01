import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogoUploader } from "@/components/logo-uploader";
import { Field, useCompanySettings } from "@/components/settings-shared";

export const Route = createFileRoute("/_authenticated/settings/brand")({
  component: BrandSettings,
});

function BrandSettings() {
  const { company, setCompany, loading, reload } = useCompanySettings();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("companies")
      .update({
        primary_color: fd.get("primary_color") as string,
        logo_url: (fd.get("logo_url") as string) || null,
      } as any)
      .eq("id", company.id);
    if (error) return toast.error(error.message);
    toast.success("Brand saved");
    reload();
  }

  if (loading || !company) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Brand</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={save}>
          <LogoUploader
            companyId={company.id}
            logoUrl={company.logo_url}
            onChange={(url) => setCompany({ ...company, logo_url: url })}
          />
          <input type="hidden" name="logo_url" value={company.logo_url ?? ""} />
          <Field name="primary_color" label="Brand color" type="color" defaultValue={company.primary_color} />
          <Button className="w-full">Save brand</Button>
        </form>
      </CardContent>
    </Card>
  );
}
