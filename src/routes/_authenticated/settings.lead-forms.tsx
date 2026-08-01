import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadFormsEditor } from "@/components/lead-forms-editor";
import { useCompanySettings } from "@/components/settings-shared";

export const Route = createFileRoute("/_authenticated/settings/lead-forms")({
  component: LeadFormsSettings,
});

function LeadFormsSettings() {
  const { company, loading } = useCompanySettings();
  if (loading || !company) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead forms</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create embeddable web forms for your website. Submissions create a new deal automatically.
        </p>
      </CardHeader>
      <CardContent>
        <LeadFormsEditor companyId={company.id} />
      </CardContent>
    </Card>
  );
}
