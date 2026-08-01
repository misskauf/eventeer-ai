import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractTemplatesEditor } from "@/components/contracts-panel";
import { useCompanySettings } from "@/components/settings-shared";

export const Route = createFileRoute("/_authenticated/settings/contract-templates")({
  component: ContractTemplatesSettings,
});

function ContractTemplatesSettings() {
  const { company, loading } = useCompanySettings();
  if (loading || !company) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return (
    <Card>
      <CardHeader><CardTitle>Contract templates</CardTitle></CardHeader>
      <CardContent>
        <ContractTemplatesEditor companyId={company.id} />
      </CardContent>
    </Card>
  );
}
