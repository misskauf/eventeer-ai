import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Field, useCompanySettings } from "@/components/settings-shared";

export const Route = createFileRoute("/_authenticated/settings/workflow")({
  component: WorkflowSettings,
});

function WorkflowSettings() {
  const { company, loading, reload } = useCompanySettings();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("companies")
      .update({
        require_deal_approval: fd.get("require_deal_approval") === "on",
        proposal_reminder_days: Math.min(60, Math.max(1, Number(fd.get("proposal_reminder_days") ?? 5))),
      } as any)
      .eq("id", company.id);
    if (error) return toast.error(error.message);
    toast.success("Workflow saved");
    reload();
  }

  if (loading || !company) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Deals & workflow</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={save}>
          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              name="require_deal_approval"
              defaultChecked={!!company.require_deal_approval}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Require internal approval before sending to client</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                When on, deals must be approved by another team member before the proposal can be sent to the client.
              </span>
            </span>
          </label>
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Client follow-up</div>
            <p className="text-xs text-muted-foreground">
              How many days after a proposal is sent before EventFlow suggests reminding the client.
            </p>
            <Field
              name="proposal_reminder_days"
              label="Remind client after (days)"
              type="number"
              defaultValue={company.proposal_reminder_days ?? 5}
            />
          </div>
          <Button className="w-full">Save workflow</Button>
        </form>
      </CardContent>
    </Card>
  );
}
