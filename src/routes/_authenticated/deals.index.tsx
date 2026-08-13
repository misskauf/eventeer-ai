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
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { useTranslation } from "@/i18n";
import { approvalLabel, approvalToneClass } from "@/lib/deal-approval";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/use-permissions";
import { RequirePermission } from "@/components/permission-guard";
import { normalizeFields, PRESET_FIELDS, type CustomFieldDef } from "@/lib/lead-forms";
import { archiveDeal, restoreDeal } from "@/lib/deal-lifecycle";
import { DeleteDealDialog } from "@/components/delete-deal-dialog";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DealsBoard } from "@/components/deals-board";
import { useServerFn } from "@tanstack/react-start";
import { listTeam } from "@/lib/team.functions";
import { LayoutGrid, List as ListIcon } from "lucide-react";


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
  archived_at: string | null;
  owner_id: string | null;
};

type ActivityRow = {
  deal_id: string;
  actor_id: string | null;
  kind: string;
  meta: any;
  created_at: string;
};

/** Human-readable one-liner for a history entry. */
function activityLabel(a: ActivityRow): string {
  const base = a.kind.replace(/_/g, " ");
  const note =
    typeof a.meta?.note === "string" && a.meta.note.trim() ? a.meta.note.trim() : null;
  if (note) return `${base}: ${note}`;
  if (a.kind === "stage_changed" && a.meta?.to) {
    return a.meta?.from
      ? `${stageLabel(String(a.meta.from))} → ${stageLabel(String(a.meta.to))}`
      : stageLabel(String(a.meta.to));
  }
  return base.charAt(0).toUpperCase() + base.slice(1);
}

const VIEW_KEY = "eventeer.deals.view";



function DealsPage() {
  const { t } = useTranslation();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [requireApproval, setRequireApproval] = useState(false);
  const [awaitingMine, setAwaitingMine] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minValue, setMinValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  const [lastActivity, setLastActivity] = useState<Record<string, ActivityRow>>({});
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const currency = useCompanyCurrency();
  const loadTeam = useServerFn(listTeam);
  const { scope, can, loading: permLoading } = usePermissions();
  const dealScope = scope("deals");
  const canEditDeals = can("deals", "edit");
  const canDeleteDeals = can("deals", "admin");

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
        "id, client_name, client_email, client_company, event_date, guest_count, stage, estimated_value, updated_at, approval_status, approval_requested_by, archived_at, owner_id",
      )
      .order("updated_at", { ascending: false });
    // Roles scoped to "own records" only see the deals they own.
    if (dealScope === "own" && userData.user?.id) query = query.eq("owner_id", userData.user.id);
    // Archived deals are hidden from the pipeline unless the toggle is on.
    if (showArchived) query = query.not("archived_at", "is", null);
    else query = query.is("archived_at", null);
    const { data } = await query;
    const rows = (data as Deal[]) ?? [];
    setDeals(rows);
    setLoading(false);
    loadActivity(rows.map((d) => d.id));
  }

  // Latest history entry per deal, shown on the Kanban cards.
  async function loadActivity(dealIds: string[]) {
    if (dealIds.length === 0) {
      setLastActivity({});
      return;
    }
    const { data } = await supabase
      .from("deal_activities")
      .select("deal_id, actor_id, kind, meta, created_at")
      .in("deal_id", dealIds.slice(0, 200))
      .order("created_at", { ascending: false })
      .limit(1000);
    const map: Record<string, ActivityRow> = {};
    for (const a of (data as ActivityRow[]) ?? []) {
      if (!map[a.deal_id]) map[a.deal_id] = a;
    }
    setLastActivity(map);
  }

  // Resolve teammate names for activity authors (best effort — needs team view).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadTeam({ data: undefined } as never);
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const m of (res as any)?.members ?? []) {
          if (m.user_id && m.email) map[m.user_id] = String(m.email).split("@")[0];
        }
        setActorNames(map);
      } catch {
        /* no team access — fall back to short ids */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function personLabel(id: string | null) {
    if (!id) return t("deals.board_unassigned", { defaultValue: "Unassigned" });
    if (id === userId) return t("deals.board_owner_me", { defaultValue: "Me" });
    return actorNames[id] ?? `${id.slice(0, 8)}…`;
  }


  useEffect(() => {
    if (!permLoading) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, dealScope, showArchived]);

  // Remember the last used view per user (this device).
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(VIEW_KEY) : null;
    if (saved === "board" || saved === "list") setView(saved);
  }, []);

  function changeView(next: "list" | "board") {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }

  // Live board: stage changes made elsewhere land in the right column without a reload.
  useEffect(() => {
    if (permLoading) return;
    const channel = supabase
      .channel("deals-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => {
        refresh();
      })
      .subscribe();
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, dealScope, showArchived]);

  async function onArchive(d: Deal) {
    try {
      await archiveDeal(d.id);
      toast.success(t("deals.archived_toast"));
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? t("deals.archive_failed"));
    }
  }

  async function onRestore(d: Deal) {
    try {
      await restoreDeal(d.id);
      toast.success(t("deals.restored_toast"));
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? t("deals.restore_failed"));
    }
  }

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
      setLastActivity((cur) => ({
        ...cur,
        [dealId]: {
          deal_id: dealId,
          actor_id: userData.user!.id,
          kind: "stage_changed",
          meta: { from: prev, to: next },
          created_at: new Date().toISOString(),
        },
      }));
    }
    toast.success(t("deals.moved_toast", { stage: stageLabel(next) }));
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

  const ownerOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const d of deals) if (d.owner_id) ids.add(d.owner_id);
    return Array.from(ids).map((id) => ({
      id,
      label: id === userId ? t("deals.owner_me", { defaultValue: "Me" }) : actorNames[id] ?? `${id.slice(0, 8)}…`,
    }));
  }, [deals, actorNames, userId, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minValue.trim() === "" ? null : Number(minValue);
    return deals.filter((d) => {
      if (stageFilter.startsWith("group:")) {
        const group = STAGE_GROUPS[stageFilter.slice(6)] ?? [];
        if (!group.includes(d.stage as never)) return false;
      } else if (stageFilter !== "all" && d.stage !== stageFilter) return false;
      if (awaitingMine) {
        if (d.approval_status !== "pending") return false;
        if (d.approval_requested_by === userId) return false;
      }
      if (ownerFilter === "unassigned") {
        if (d.owner_id) return false;
      } else if (ownerFilter !== "all" && d.owner_id !== ownerFilter) return false;
      if (dateFrom || dateTo) {
        if (!d.event_date) return false;
        if (dateFrom && d.event_date < dateFrom) return false;
        if (dateTo && d.event_date > dateTo) return false;
      }
      if (min !== null && Number.isFinite(min) && Number(d.estimated_value ?? 0) < min) return false;
      if (!q) return true;
      return (
        d.client_name.toLowerCase().includes(q) ||
        d.client_email.toLowerCase().includes(q) ||
        (d.client_company ?? "").toLowerCase().includes(q)
      );
    });
  }, [deals, search, stageFilter, awaitingMine, userId, ownerFilter, dateFrom, dateTo, minValue]);

  const hasExtraFilters =
    ownerFilter !== "all" || dateFrom !== "" || dateTo !== "" || minValue.trim() !== "";



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
        title={t("deals.title")}
        description={t("deals.description")}
        action={<NewDealDialog onCreated={(id) => navigate({ to: "/deals/$id", params: { id } })} />}
      />
      <DealsTabs />


      {loading ? null : deals.length === 0 && !showArchived ? (
        <EmptyState
          title={t("deals.empty_title")}
          body={t("deals.empty_body")}
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
                placeholder={t("deals.search_placeholder")}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground">
                {t("deals.count", { shown: filtered.length, total: deals.length })}
              </div>
              <div className="inline-flex rounded-md border p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={view === "board" ? "secondary" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => changeView("board")}
                >
                  <LayoutGrid className="mr-1 h-3.5 w-3.5" />
                  {t("deals.view_kanban", { defaultValue: "Kanban" })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={view === "list" ? "secondary" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => changeView("list")}
                >
                  <ListIcon className="mr-1 h-3.5 w-3.5" />
                  {t("deals.view_list", { defaultValue: "List" })}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <StageChip
                label={t("deals.filter_all")}
                count={stageCounts.all}
                active={stageFilter === "all"}
                onClick={() => setStageFilter("all")}
              />
              {Object.entries(STAGE_GROUPS).map(([key, stages]) => (
                <StageChip
                  key={key}
                  label={t(`deals.group_${key}`, { defaultValue: STAGE_GROUP_LABELS[key] ?? key })}
                  count={stages.reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0)}
                  active={stageFilter === `group:${key}`}
                  onClick={() => setStageFilter(`group:${key}`)}
                />
              ))}
              <StageChip
                label={t("deals.filter_archived")}
                count={showArchived ? deals.length : 0}
                active={showArchived}
                onClick={() => setShowArchived((v) => !v)}
              />
              {requireApproval && (
                <StageChip
                  label={t("deals.filter_awaiting")}
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
                <SelectValue placeholder={t("deals.all_stages")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("deals.all_stages")}</SelectItem>
                {STAGE_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                {t("deals.filter_owner", { defaultValue: "Owner" })}
              </Label>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("deals.filter_owner_all", { defaultValue: "All owners" })}
                  </SelectItem>
                  {ownerOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="unassigned">
                    {t("deals.filter_owner_none", { defaultValue: "Unassigned" })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                {t("deals.filter_date_from", { defaultValue: "Event from" })}
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                {t("deals.filter_date_to", { defaultValue: "Event to" })}
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                {t("deals.filter_min_value", { defaultValue: "Min. value" })}
              </Label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                placeholder="0"
                className="h-8 w-[120px] text-xs"
              />
            </div>
            {hasExtraFilters && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => {
                  setOwnerFilter("all");
                  setDateFrom("");
                  setDateTo("");
                  setMinValue("");
                }}
              >
                {t("deals.filter_reset", { defaultValue: "Reset filters" })}
              </Button>
            )}
          </div>


          {view === "board" ? (
            <DealsBoard
              deals={filtered.map((d) => {
                const a = lastActivity[d.id];
                return {
                  id: d.id,
                  client_name: d.client_name,
                  client_company: d.client_company,
                  event_date: d.event_date,
                  estimated_value: Number(d.estimated_value),
                  stage: d.stage,
                  owner_id: d.owner_id,
                  last_activity: a
                    ? {
                        label: activityLabel(a),
                        actor: personLabel(a.actor_id),
                        at: a.created_at,
                      }
                    : null,
                };
              })}
              currency={currency}
              canEdit={canEditDeals}
              ownerLabel={personLabel}
              onOpen={(id) => openDeal(id)}
              onMove={(id, stage) => updateStage(id, stage)}
            />

          ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">{t("deals.col_client")}</th>
                      <th className="px-4 py-2 text-left font-medium">{t("deals.col_event_date")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("deals.col_guests")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("deals.col_value")}</th>

                      <th className="px-4 py-2 text-left font-medium">{t("deals.col_stage")}</th>
                      {requireApproval && (
                        <th className="px-4 py-2 text-left font-medium">{t("deals.col_approval")}</th>
                      )}
                      <th className="px-4 py-2 text-left font-medium">{t("deals.col_updated")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("deals.col_action")}</th>
                    </tr>

                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((d) => (
                      <tr
                        key={d.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/40 focus-within:bg-muted/40",
                          d.archived_at && "opacity-60",
                        )}
                        tabIndex={0}
                        role="button"
                        aria-label={t("deals.open_deal", { name: d.client_name })}
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
                          <div className="flex items-center gap-2 font-medium">
                            {d.client_name}
                            {d.archived_at && (
                              <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {t("deals.badge_archived")}
                              </span>
                            )}
                          </div>
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
                                  <DropdownMenuLabel>{t("deals.move_to_stage")}</DropdownMenuLabel>
                                  {STAGE_ORDER.map((s) => (
                                    <DropdownMenuItem
                                      key={s}
                                      disabled={s === d.stage}
                                      onSelect={() => updateStage(d.id, s)}
                                    >
                                      {stageLabel(s)}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  {d.archived_at ? (
                                    <DropdownMenuItem onSelect={() => onRestore(d)}>
                                      <ArchiveRestore className="mr-2 h-4 w-4" /> {t("deals.restore")}
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onSelect={() => onArchive(d)}>
                                      <Archive className="mr-2 h-4 w-4" /> {t("deals.archive")}
                                    </DropdownMenuItem>
                                  )}
                                  {canDeleteDeals && (
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onSelect={() => setDeleteTarget(d)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> {t("deals.delete_permanently")}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openDeal(d.id, true)}
                            >
                              <Pencil className="mr-1 h-4 w-4" /> {t("deals.edit")}
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
                          {t("deals.no_match")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      )}
      {deleteTarget && (
        <DeleteDealDialog
          open={!!deleteTarget}
          onOpenChange={(v) => !v && setDeleteTarget(null)}
          dealId={deleteTarget.id}
          clientName={deleteTarget.client_name}
          onDeleted={() => {
            setDeleteTarget(null);
            refresh();
          }}
        />
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

/** Preset lead-form keys already covered by the core New deal inputs. */
const CORE_PRESET_KEYS = new Set([
  "name",
  "email",
  "company",
  "event_type",
  "event_date",
  "guest_count",
  "message",
]);

type ExtraField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  preset: boolean;
};

/** Union of all fields enabled on the company's active lead forms (minus core inputs). */
function mergeLeadFormFields(rawForms: unknown[]): ExtraField[] {
  const configs = rawForms.map((f) => normalizeFields((f as any)?.fields));
  if (!configs.length) return [];

  const presets: ExtraField[] = [];
  for (const meta of PRESET_FIELDS) {
    if (CORE_PRESET_KEYS.has(meta.key)) continue;
    const using = configs.filter((c) => c.preset[meta.key]?.enabled);
    if (!using.length) continue;
    presets.push({
      key: meta.key,
      label: meta.label,
      type: meta.type,
      required: using.every((c) => !!c.preset[meta.key]?.required),
      preset: true,
    });
  }

  const customMap = new Map<string, { def: CustomFieldDef; count: number; required: number }>();
  for (const c of configs) {
    for (const f of c.custom) {
      const cur = customMap.get(f.key);
      if (cur) {
        cur.count += 1;
        if (f.required) cur.required += 1;
      } else {
        customMap.set(f.key, { def: f, count: 1, required: f.required ? 1 : 0 });
      }
    }
  }
  const customs: ExtraField[] = [...customMap.values()].map(({ def, count, required }) => ({
    key: def.key,
    label: def.label,
    type: def.type,
    required: required === count,
    options: def.options,
    placeholder: def.placeholder,
    help: def.help,
    preset: false,
  }));

  return [...presets, ...customs];
}

function NewDealDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [extraFields, setExtraFields] = useState<ExtraField[]>([]);
  const [extraValues, setExtraValues] = useState<Record<string, unknown>>({});
  const { can } = usePermissions();
  const canCreate = can("deals", "edit");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: role } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();
      if (!role?.company_id) return;
      const { data: forms } = await supabase
        .from("lead_forms")
        .select("id, fields")
        .eq("company_id", role.company_id)
        .eq("active", true);
      if (cancelled) return;
      setExtraFields(mergeLeadFormFields(forms ?? []));
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function setExtra(key: string, value: unknown) {
    setExtraValues((v) => ({ ...v, [key]: value }));
  }

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

    // Extra lead-form values: preset fields with a deal column patch the row,
    // everything else lands in custom_fields (same shape as public submissions).
    const dealPatch: Record<string, unknown> = {};
    const customFields: Record<string, { label: string; value: unknown }> = {};
    for (const f of extraFields) {
      const raw = extraValues[f.key];
      const empty =
        raw === undefined ||
        raw === null ||
        (typeof raw === "string" && raw.trim() === "") ||
        (f.type === "checkbox" && !raw);
      if (empty) {
        if (f.required) {
          setBusy(false);
          return toast.error(t("deals.complete_field", { label: f.label }));
        }
        continue;
      }
      const value =
        f.type === "number"
          ? Number(raw)
          : f.type === "checkbox"
            ? !!raw
            : typeof raw === "string"
              ? raw.trim()
              : raw;
      const meta = f.preset ? PRESET_FIELDS.find((p) => p.key === f.key) : undefined;
      if (meta?.dealColumn) dealPatch[meta.dealColumn] = value;
      else customFields[f.key] = { label: f.label, value };
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
        ...dealPatch,
        custom_fields: customFields as any,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !deal) return toast.error(error?.message ?? t("deals.create_failed"));
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
    setExtraValues({});
    onCreated(deal.id);
  }

  if (!canCreate) return null;

  const presetExtras = extraFields.filter((f) => f.preset);
  const customExtras = extraFields.filter((f) => !f.preset);

  function renderExtra(f: ExtraField) {
    const value = extraValues[f.key];
    if (f.type === "textarea") {
      return (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`x_${f.key}`}>
            {f.label}
            {f.required && " *"}
          </Label>
          <Textarea
            id={`x_${f.key}`}
            rows={3}
            placeholder={f.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => setExtra(f.key, e.target.value)}
          />
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      );
    }
    if (f.type === "checkbox") {
      return (
        <label key={f.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={!!value}
            onChange={(e) => setExtra(f.key, e.target.checked)}
          />
          <span>
            {f.label}
            {f.required && " *"}
          </span>
        </label>
      );
    }
    if (f.type === "select") {
      return (
        <div key={f.key} className="space-y-1.5">
          <Label>
            {f.label}
            {f.required && " *"}
          </Label>
          <Select value={(value as string) ?? ""} onValueChange={(v) => setExtra(f.key, v)}>
            <SelectTrigger>
              <SelectValue placeholder={t("deals.select_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {(f.options ?? []).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      );
    }
    return (
      <div key={f.key} className="space-y-1.5">
        <Label htmlFor={`x_${f.key}`}>
          {f.label}
          {f.required && " *"}
        </Label>
        <Input
          id={`x_${f.key}`}
          type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type}
          placeholder={f.placeholder}
          value={(value as string | number | undefined) ?? ""}
          onChange={(e) => setExtra(f.key, e.target.value)}
        />
        {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> {t("deals.new_deal")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("deals.new_deal")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field name="client_name" label={t("deals.client_name")} required />
            <Field name="client_email" label={t("deals.client_email")} type="email" required />
          </div>
          <Field name="client_company" label={t("deals.client_company")} />
          <div className="grid grid-cols-3 gap-3">
            <Field name="event_type" label={t("deals.event_type")} placeholder={t("deals.event_type_placeholder")} />
            <Field name="event_date" label={t("deals.col_event_date")} type="date" />
            <Field name="guest_count" label={t("deals.col_guests")} type="number" />
          </div>
          {presetExtras.length > 0 && (
            <div className="grid grid-cols-2 gap-3">{presetExtras.map(renderExtra)}</div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("deals.notes")}</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          {customExtras.length > 0 && (
            <div className="space-y-3 border-t pt-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("deals.additional_details")}
              </div>
              {customExtras.map(renderExtra)}
            </div>
          )}
          <Button className="w-full" disabled={busy}>
            {busy ? t("deals.creating") : t("deals.create_deal")}
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
