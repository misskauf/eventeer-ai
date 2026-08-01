import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listTeam } from "@/lib/team.functions";
import { usePermissions } from "@/lib/use-permissions";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  METRIC_LABEL,
  PERIOD_LABEL,
  currentPeriodStart,
  normalizePeriodStart,
  periodLabel,
  shiftPeriod,
  type Goal,
  type GoalMetric,
  type GoalPeriodType,
} from "@/lib/goals";

export const Route = createFileRoute("/_authenticated/settings/goals")({
  component: GoalsSettings,
});

const NONE = "__none__";

type Draft = {
  id: string | null;
  metric: GoalMetric;
  period_type: GoalPeriodType;
  period_start: string;
  target: string;
  owner_id: string;
  space_id: string;
};

function emptyDraft(): Draft {
  return {
    id: null,
    metric: "net_revenue",
    period_type: "month",
    period_start: currentPeriodStart("month"),
    target: "",
    owner_id: NONE,
    space_id: NONE,
  };
}

function GoalsSettings() {
  const { companyId, can, loading: permLoading } = usePermissions();
  const currency = useCompanyCurrency();
  const canEdit = can("settings", "edit");
  const loadTeam = useServerFn(listTeam);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ user_id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    const [g, sp] = await Promise.all([
      supabase
        .from("goals")
        .select("id, company_id, metric, period_type, period_start, target, owner_id, space_id")
        .eq("company_id", companyId)
        .order("period_start", { ascending: false }),
      supabase.from("spaces").select("id, name").eq("company_id", companyId).order("name"),
    ]);
    setGoals(((g.data as any[]) ?? []) as Goal[]);
    setSpaces(((sp.data as any[]) ?? []) as { id: string; name: string }[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (permLoading) return;
    void load();
  }, [permLoading, load]);

  useEffect(() => {
    if (permLoading) return;
    (async () => {
      try {
        const data = await loadTeam();
        setMembers(
          (data.members ?? [])
            .filter((m: any) => m.active !== false)
            .map((m: any) => ({ user_id: m.user_id, label: m.email ?? `${m.user_id.slice(0, 8)}…` })),
        );
      } catch {
        setMembers([]);
      }
    })();
  }, [permLoading, loadTeam]);

  const spaceName = (id: string | null) =>
    id ? (spaces.find((s) => s.id === id)?.name ?? "Space") : null;
  const memberName = (id: string | null) =>
    id ? (members.find((m) => m.user_id === id)?.label ?? `${id.slice(0, 8)}…`) : null;

  const grouped = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of goals) {
      const key = `${g.period_type}:${g.period_start}`;
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return Array.from(map.entries()).sort((a, b) => b[1][0].period_start.localeCompare(a[1][0].period_start));
  }, [goals]);

  async function saveDraft() {
    if (!draft || !companyId) return;
    const target = Number(draft.target);
    if (!Number.isFinite(target) || target <= 0) {
      toast.error("Enter a target greater than zero.");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: companyId,
      metric: draft.metric,
      period_type: draft.period_type,
      period_start: normalizePeriodStart(draft.period_start, draft.period_type),
      target,
      owner_id: draft.owner_id === NONE ? null : draft.owner_id,
      space_id: draft.space_id === NONE ? null : draft.space_id,
    };
    const { error } = draft.id
      ? await supabase.from("goals").update(payload as any).eq("id", draft.id)
      : await supabase.from("goals").insert(payload as any);
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "A goal already exists for this metric, period and scope."
          : error.message,
      );
      return;
    }
    toast.success(draft.id ? "Goal updated." : "Goal created.");
    setDraft(null);
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Goal removed.");
    void load();
  }

  /** Copies the newest monthly targets into the following month. */
  async function copyForward() {
    if (!companyId) return;
    const monthly = goals.filter((g) => g.period_type === "month");
    if (!monthly.length) return toast.error("No monthly goals to copy.");
    const latest = monthly[0].period_start;
    const source = monthly.filter((g) => g.period_start === latest);
    const next = shiftPeriod(latest, "month", 1);
    const rows = source.map((g) => ({
      company_id: companyId,
      metric: g.metric,
      period_type: "month",
      period_start: next,
      target: g.target,
      owner_id: g.owner_id,
      space_id: g.space_id,
    }));
    const { error } = await supabase.from("goals").upsert(rows as any, { ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    toast.success(`Copied ${rows.length} target(s) to ${periodLabel(next, "month")}.`);
    void load();
  }

  if (loading || permLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>Revenue goals</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Targets are measured against signed deals. Anyone with analytics access can see progress.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copyForward}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              Copy to next month
            </Button>
            <Button size="sm" onClick={() => setDraft(emptyDraft())}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New goal
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {grouped.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No goals yet. {canEdit ? "Create your first monthly revenue target." : ""}
          </div>
        )}

        {grouped.map(([key, list]) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {periodLabel(list[0].period_start, list[0].period_type)}
              <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {PERIOD_LABEL[list[0].period_type]}
              </span>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Metric</th>
                    <th className="px-3 py-2 text-left">Scope</th>
                    <th className="px-3 py-2 text-right">Target</th>
                    {canEdit && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {list.map((g) => (
                    <tr key={g.id} className="border-t">
                      <td className="px-3 py-2">{METRIC_LABEL[g.metric]}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {[memberName(g.owner_id), spaceName(g.space_id)].filter(Boolean).join(" · ") ||
                          "Whole company"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(g.target, currency)}</td>
                      {canEdit && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() =>
                              setDraft({
                                id: g.id,
                                metric: g.metric,
                                period_type: g.period_type,
                                period_start: g.period_start,
                                target: String(g.target),
                                owner_id: g.owner_id ?? NONE,
                                space_id: g.space_id ?? NONE,
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-destructive"
                            onClick={() => remove(g.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit goal" : "New revenue goal"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Metric</Label>
                  <Select
                    value={draft.metric}
                    onValueChange={(v) => setDraft({ ...draft, metric: v as GoalMetric })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="net_revenue">Net revenue</SelectItem>
                      <SelectItem value="gross_revenue">Gross revenue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Period</Label>
                  <Select
                    value={draft.period_type}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        period_type: v as GoalPeriodType,
                        period_start: normalizePeriodStart(draft.period_start, v as GoalPeriodType),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="quarter">Quarterly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="period_start">Period start</Label>
                  <Input
                    id="period_start"
                    type="date"
                    value={draft.period_start}
                    onChange={(e) => setDraft({ ...draft, period_start: e.target.value })}
                    onBlur={() =>
                      setDraft({
                        ...draft,
                        period_start: normalizePeriodStart(draft.period_start, draft.period_type),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {periodLabel(draft.period_start, draft.period_type)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="target">Target ({currency})</Label>
                  <Input
                    id="target"
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.target}
                    onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Salesperson (optional)</Label>
                  <Select
                    value={draft.owner_id}
                    onValueChange={(v) => setDraft({ ...draft, owner_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Whole team</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Space (optional)</Label>
                  <Select
                    value={draft.space_id}
                    onValueChange={(v) => setDraft({ ...draft, space_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>All spaces</SelectItem>
                      {spaces.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveDraft} disabled={saving}>
              {saving ? "Saving…" : "Save goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
