import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DealsTabs } from "@/components/deals-tabs";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";
import {
  STAGE_ORDER,
  STAGE_GROUPS,
  STAGE_GROUP_LABELS,
  formatRelative,
  stageLabel,
  stageToneClass,
} from "@/lib/deal-stages";
import { formatEventDate } from "@/lib/date-format";
import { approvalLabel, approvalToneClass } from "@/lib/deal-approval";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/use-permissions";
import { RequirePermission } from "@/components/permission-guard";


export const Route = createFileRoute("/_authenticated/deals/")({
  component: () => (
    <RequirePermission module="deals">
      <DealsPage />
    </RequirePermission>
  ),
});

type Deal = {
  id: string;
  client_name: string;
  client_email: string;
  client_company: string | null;
  event_date: string | null;
  guest_count: number;
  stage: string;
  estimated_value: number;
  updated_at: string;
  approval_status: string;
  approval_requested_by: string | null;
};


function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [requireApproval, setRequireApproval] = useState(false);
  const [awaitingMine, setAwaitingMine] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const currency = useCompanyCurrency();
  const { scope, can, loading: permLoading } = usePermissions();
  const dealScope = scope("deals");
  const canEditDeals = can("deals", "edit");

  async function refresh() {
    const { data: userData } = await supabase.auth.getUser();
    setUserId(userData.user?.id ?? null);
    const { data: co } = await supabase
      .from("companies")
      .select("require_deal_approval")
      .limit(1)
      .maybeSingle();
    setRequireApproval(!!(co as any)?.require_deal_approval);
    let query = supabase
      .from("deals")
      .select(
        "id, client_name, client_email, client_company, event_date, guest_count, stage, estimated_value, updated_at, approval_status, approval_requested_by",
      )
      .order("updated_at", { ascending: false });
    // Roles scoped to "own records" only see the deals they own.
    if (dealScope === "own" && userData.user?.id) query = query.eq("owner_id", userData.user.id);
    const { data } = await query;
    setDeals((data as Deal[]) ?? []);
    setLoading(false);
  }


  useEffect(() => {
    if (!permLoading) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, dealScope]);

  async function updateStage(dealId: string, next: string) {
    const prev = deals.find((d) => d.id === dealId)?.stage;
    setDeals((cur) =>
      cur.map((d) =>
        d.id === dealId ? { ...d, stage: next, updated_at: new Date().toISOString() } : d,
      ),
    );
    const { error } = await supabase
      .from("deals")
      .update({ stage: next as any })
      .eq("id", dealId);
    if (error) {
      toast.error(error.message);
      refresh();
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", userData.user!.id)
      .limit(1)
      .maybeSingle();
    if (role?.company_id) {
      await supabase.from("deal_activities").insert({
        deal_id: dealId,
        company_id: role.company_id,
        actor_id: userData.user!.id,
        kind: "stage_changed",
        meta: { from: prev, to: next },
      });
    }
    toast.success(`Moved to ${stageLabel(next)}`);
  }

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { all: deals.length };
    for (const s of STAGE_ORDER) c[s] = 0;
    for (const d of deals) c[d.stage] = (c[d.stage] ?? 0) + 1;
    return c;
  }, [deals]);

  const awaitingMyApprovalCount = useMemo(
    () =>
      deals.filter(
        (d) => d.approval_status === "pending" && d.approval_requested_by !== userId,
      ).length,
    [deals, userId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (stageFilter.startsWith("group:")) {
        const group = STAGE_GROUPS[stageFilter.slice(6)] ?? [];
        if (!group.includes(d.stage as never)) return false;
      } else if (stageFilter !== "all" && d.stage !== stageFilter) return false;
      if (awaitingMine) {
        if (d.approval_status !== "pending") return false;
        if (d.approval_requested_by === userId) return false;
      }
      if (!q) return true;
      return (
        d.client_name.toLowerCase().includes(q) ||
        d.client_email.toLowerCase().includes(q) ||
        (d.client_company ?? "").toLowerCase().includes(q)
      );
    });
  }, [deals, search, stageFilter, awaitingMine, userId]);


  const openDeal = (dealId: string, edit = false) => {
    navigate({
      to: "/deals/$id",
      params: { id: dealId },
      hash: edit ? "edit" : undefined,
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Deals"
        description="Every event inquiry, from first contact to paid in full."
        action={<NewDealDialog onCreated={(id) => navigate({ to: "/deals/$id", params: { id } })} />}
      />
      <DealsTabs />


      {loading ? null : deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          body="Create your first deal to get started."
          action={<NewDealDialog onCreated={(id) => navigate({ to: "/deals/$id", params: { id } })} />}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client, email, company"
                className="pl-8"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {filtered.length} of {deals.length} deals
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <StageChip
                label="All"
                count={stageCounts.all}
                active={stageFilter === "all"}
                onClick={() => setStageFilter("all")}
              />
              {Object.entries(STAGE_GROUPS).map(([key, stages]) => (
                <StageChip
                  key={key}
                  label={STAGE_GROUP_LABELS[key] ?? key}
                  count={stages.reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0)}
                  active={stageFilter === `group:${key}`}
                  onClick={() => setStageFilter(`group:${key}`)}
                />
              ))}
              {requireApproval && (
                <StageChip
                  label="Awaiting my approval"
                  count={awaitingMyApprovalCount}
                  active={awaitingMine}
                  onClick={() => setAwaitingMine((v) => !v)}
                />
              )}
            </div>
            <Select
              value={stageFilter.startsWith("group:") || stageFilter === "all" ? "all" : stageFilter}
              onValueChange={(v) => setStageFilter(v)}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {STAGE_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Client</th>
                      <th className="px-4 py-2 text-left font-medium">Event date</th>
                      <th className="px-4 py-2 text-right font-medium">Guests</th>
                      <th className="px-4 py-2 text-right font-medium">Est. value</th>

                      <th className="px-4 py-2 text-left font-medium">Stage</th>
                      {requireApproval && (
                        <th className="px-4 py-2 text-left font-medium">Approval</th>
                      )}
                      <th className="px-4 py-2 text-left font-medium">Updated</th>
                      <th className="px-4 py-2 text-right font-medium">Action</th>
                    </tr>

                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((d) => (
                      <tr
                        key={d.id}
                        className="cursor-pointer hover:bg-muted/40 focus-within:bg-muted/40"
                        tabIndex={0}
                        role="button"
                        aria-label={`Open deal for ${d.client_name}`}
                        onClick={(event) => {
                          const target = event.target as HTMLElement;
                          if (target.closest("button,a,[role='combobox']")) return;
                          openDeal(d.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openDeal(d.id);
                          }
                        }}
                      >
                        <td className="min-w-0 px-4 py-3">
                          <div className="font-medium">{d.client_name}</div>
                          {d.client_company && (
                            <div className="text-xs text-muted-foreground">{d.client_company}</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {d.event_date ? formatEventDate(d.event_date) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          {d.guest_count || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          {money(Number(d.estimated_value), currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                              stageToneClass(d.stage),
                            )}
                          >
                            {stageLabel(d.stage)}
                          </span>
                        </td>
                        {requireApproval && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {d.approval_status && d.approval_status !== "not_required" ? (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                  approvalToneClass(d.approval_status),
                                )}
                              >
                                {approvalLabel(d.approval_status)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {formatRelative(d.updated_at)}
                        </td>
                        <td
                          className="whitespace-nowrap px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            {canEditDeals && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="outline" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                                  <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
                                  {STAGE_ORDER.map((s) => (
                                    <DropdownMenuItem
                                      key={s}
                                      disabled={s === d.stage}
                                      onSelect={() => updateStage(d.id, s)}
                                    >
                                      {stageLabel(s)}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openDeal(d.id, true)}
                            >
                              <Pencil className="mr-1 h-4 w-4" /> Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={requireApproval ? 8 : 7}
                          className="px-4 py-8 text-center text-sm text-muted-foreground"
                        >
                          No deals match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function StageChip({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-foreground bg-foreground text-background"
          : tone ?? "bg-background text-foreground hover:bg-muted",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px]",
          active ? "bg-background/20" : "bg-muted-foreground/10",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function NewDealDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { can } = usePermissions();
  const canCreate = can("deals", "edit");


  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { data: userData } = await supabase.auth.getUser();
    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", userData.user!.id)
      .limit(1)
      .maybeSingle();
    if (!role?.company_id) {
      setBusy(false);
      return toast.error("No workspace");
    }
    const { data: deal, error } = await supabase
      .from("deals")
      .insert({
        company_id: role.company_id,
        owner_id: userData.user!.id,
        client_name: fd.get("client_name") as string,
        client_email: fd.get("client_email") as string,
        client_company: (fd.get("client_company") as string) || null,
        event_type: (fd.get("event_type") as string) || null,
        event_date: (fd.get("event_date") as string) || null,
        guest_count: Number(fd.get("guest_count") || 0),
        notes: (fd.get("notes") as string) || null,
        stage: "new" as any,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !deal) return toast.error(error?.message ?? "Failed");
    await supabase.from("deal_activities").insert({
      deal_id: deal.id,
      company_id: role.company_id,
      actor_id: userData.user!.id,
      kind: "deal_created",
    });
    try {
      const { notifyLeadCreated } = await import("@/lib/notifications.functions");
      await notifyLeadCreated({ data: { deal_id: deal.id } });
    } catch (err) {
      console.warn("notifyLeadCreated failed", err);
    }
    setOpen(false);
    onCreated(deal.id);
  }

  if (!canCreate) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> New deal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field name="client_name" label="Client name" required />
            <Field name="client_email" label="Client email" type="email" required />
          </div>
          <Field name="client_company" label="Client company (optional)" />
          <div className="grid grid-cols-3 gap-3">
            <Field name="event_type" label="Event type" placeholder="Wedding, gala..." />
            <Field name="event_date" label="Event date" type="date" />
            <Field name="guest_count" label="Guests" type="number" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          <Button className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Create deal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field(props: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input {...props} id={props.name} />
    </div>
  );
}
