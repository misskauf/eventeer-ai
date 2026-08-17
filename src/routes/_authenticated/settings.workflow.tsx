import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCompanySettings } from "@/components/settings-shared";
import { getFollowupConfigs, saveFollowupConfig } from "@/lib/followups.functions";
import {
  DEFAULT_FOLLOWUP,
  FOLLOWUP_DOC_TYPES,
  type FollowupChannel,
  type FollowupConfig,
  type FollowupDocType,
  type FollowupMode,
} from "@/lib/followups";

export const Route = createFileRoute("/_authenticated/settings/workflow")({
  component: WorkflowSettings,
});

const DOC_TITLES: Record<FollowupDocType, string> = {
  proposal: "Proposal",
  contract: "Contract",
};

const DOC_HINTS: Record<FollowupDocType, string> = {
  proposal: "Applies while a sent proposal has no client response.",
  contract: "Applies while a sent agreement is still unsigned.",
};

function WorkflowSettings() {
  const { company, loading, reload } = useCompanySettings();
  const loadConfigs = useServerFn(getFollowupConfigs);
  const saveConfig = useServerFn(saveFollowupConfig);

  const [configs, setConfigs] = useState<Record<FollowupDocType, FollowupConfig>>({ ...DEFAULT_FOLLOWUP });
  const [savingDoc, setSavingDoc] = useState<FollowupDocType | null>(null);

  const refreshConfigs = useCallback(async () => {
    if (!company?.id) return;
    try {
      const res = await loadConfigs({ data: { company_id: company.id } });
      const next = { ...DEFAULT_FOLLOWUP };
      for (const row of res.configs as any[]) {
        if (row.doc_type === "proposal" || row.doc_type === "contract") {
          next[row.doc_type as FollowupDocType] = { ...next[row.doc_type as FollowupDocType], ...row };
        }
      }
      setConfigs(next);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not load follow-up settings");
    }
  }, [company?.id, loadConfigs]);

  useEffect(() => {
    refreshConfigs();
  }, [refreshConfigs]);

  function patch(doc: FollowupDocType, values: Partial<FollowupConfig>) {
    setConfigs((prev) => ({ ...prev, [doc]: { ...prev[doc], ...values } }));
  }

  async function persist(doc: FollowupDocType) {
    if (!company?.id) return;
    const cfg = configs[doc];
    setSavingDoc(doc);
    try {
      await saveConfig({
        data: {
          company_id: company.id,
          config: {
            doc_type: doc,
            enabled: cfg.enabled,
            mode: cfg.mode,
            channel: cfg.channel,
            interval_days: Math.min(180, Math.max(1, Number(cfg.interval_days) || 5)),
            max_reminders: cfg.max_reminders == null ? null : Math.min(20, Math.max(1, Number(cfg.max_reminders))),
          },
        },
      });
      toast.success(`${DOC_TITLES[doc]} follow-up saved`);
      refreshConfigs();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save");
    } finally {
      setSavingDoc(null);
    }
  }

  async function saveWorkflow(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("companies")
      .update({ require_deal_approval: fd.get("require_deal_approval") === "on" } as any)
      .eq("id", company.id);
    if (error) return toast.error(error.message);
    toast.success("Workflow saved");
    reload();
  }

  if (loading || !company) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Deals & workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={saveWorkflow}>
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
            <Button className="w-full">Save workflow</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client follow-ups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Set a separate follow-up rhythm per document. A daily check runs automatically and either emails the client
            for you, or tells your team to reach out.
          </p>

          {FOLLOWUP_DOC_TYPES.map((doc) => {
            const cfg = configs[doc];
            return (
              <div key={doc} className="space-y-3 rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{DOC_TITLES[doc]}</div>
                    <p className="text-xs text-muted-foreground">{DOC_HINTS[doc]}</p>
                  </div>
                  <Switch checked={cfg.enabled} onCheckedChange={(v) => patch(doc, { enabled: v })} />
                </div>

                {cfg.enabled && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Follow-up mode</Label>
                      <Select value={cfg.mode} onValueChange={(v) => patch(doc, { mode: v as FollowupMode })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Send to the client automatically</SelectItem>
                          <SelectItem value="notify">Notify me — I'll contact the client</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Notify my team via</Label>
                      <Select value={cfg.channel} onValueChange={(v) => patch(doc, { channel: v as FollowupChannel })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_app">In the system only</SelectItem>
                          <SelectItem value="email">Email only</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`${doc}-days`}>Remind every (days)</Label>
                      <Input
                        id={`${doc}-days`}
                        type="number"
                        min={1}
                        max={180}
                        value={cfg.interval_days}
                        onChange={(e) => patch(doc, { interval_days: Number(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`${doc}-max`}>Stop after (reminders)</Label>
                      <Input
                        id={`${doc}-max`}
                        type="number"
                        min={1}
                        max={20}
                        placeholder="No limit"
                        value={cfg.max_reminders ?? ""}
                        onChange={(e) =>
                          patch(doc, { max_reminders: e.target.value === "" ? null : Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                )}

                <Button size="sm" onClick={() => persist(doc)} disabled={savingDoc === doc}>
                  {savingDoc === doc ? "Saving…" : `Save ${DOC_TITLES[doc].toLowerCase()} follow-up`}
                </Button>
              </div>
            );
          })}

          <div className="rounded-md border border-dashed p-3">
            <div className="text-sm font-medium text-muted-foreground">Invoice</div>
            <p className="text-xs text-muted-foreground">
              Coming soon — invoices don't have a client-facing link yet.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
