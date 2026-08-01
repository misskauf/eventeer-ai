import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/lib/use-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartTypeToggle, periodRange, type Range } from "@/components/analytics-widgets";
import {
  WIDGET_MAP,
  defaultConfig,
  normalizeConfig,
  sizeClass,
  type WidgetConfig,
  type WidgetDef,
  type WidgetSize,
} from "@/lib/dashboard-widgets";

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

export function useDashboardConfig() {
  const { companyId, loading: permLoading } = usePermissions();
  const [userId, setUserId] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [companyDefault, setCompanyDefault] = useState<WidgetConfig[] | null>(null);
  const [config, setConfig] = useState<WidgetConfig[]>(defaultConfig());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permLoading) return;
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!companyId || !uid) {
        if (alive) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("dashboard_layouts")
        .select("id, user_id, config")
        .eq("company_id", companyId);
      if (!alive) return;
      const rows = (data as any[]) ?? [];
      const mine = rows.find((r) => r.user_id === uid);
      const fallback = rows.find((r) => r.user_id === null);
      setUserId(uid);
      setRowId(mine?.id ?? null);
      setCompanyDefault(fallback ? normalizeConfig(fallback.config) : null);
      setConfig(
        mine
          ? normalizeConfig(mine.config)
          : fallback
            ? normalizeConfig(fallback.config)
            : defaultConfig(),
      );
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [companyId, permLoading]);

  const save = useCallback(
    async (next: WidgetConfig[]) => {
      setConfig(next);
      if (!companyId || !userId) return;
      if (rowId) {
        await supabase.from("dashboard_layouts").update({ config: next as any }).eq("id", rowId);
      } else {
        const { data } = await supabase
          .from("dashboard_layouts")
          .insert({ company_id: companyId, user_id: userId, config: next as any })
          .select("id")
          .maybeSingle();
        if (data?.id) setRowId(data.id);
      }
    },
    [companyId, userId, rowId],
  );

  const reset = useCallback(async () => {
    const next = companyDefault ?? defaultConfig();
    setConfig(next);
    if (rowId) {
      await supabase.from("dashboard_layouts").delete().eq("id", rowId);
      setRowId(null);
    }
    return next;
  }, [companyDefault, rowId]);

  return { config, setConfig, save, reset, loading: loading || permLoading };
}

/* -------------------------------------------------------------------------- */
/* Per-widget range, driven by the saved config                               */
/* -------------------------------------------------------------------------- */

function RangeControl({
  entry,
  onChange,
}: {
  entry: WidgetConfig;
  onChange: (patch: Partial<WidgetConfig>) => void;
}) {
  const o = entry.date_range_override;
  const mode = o?.mode ?? "global";
  const set = (next: { mode: string; from: string; to: string } | null) =>
    onChange({ date_range_override: next });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={mode}
        onValueChange={(m) =>
          set(m === "global" ? null : { mode: m, from: o?.from ?? "", to: o?.to ?? "" })
        }
      >
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="global">Global period</SelectItem>
          <SelectItem value="month">This month</SelectItem>
          <SelectItem value="quarter">This quarter</SelectItem>
          <SelectItem value="year">This year</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      {mode === "custom" && (
        <>
          <Input
            type="date"
            aria-label="From"
            className="h-8 w-[140px] text-xs"
            value={o?.from ?? ""}
            onChange={(e) => set({ mode, from: e.target.value, to: o?.to ?? "" })}
          />
          <Input
            type="date"
            aria-label="To"
            className="h-8 w-[140px] text-xs"
            value={o?.to ?? ""}
            onChange={(e) => set({ mode, from: o?.from ?? "", to: e.target.value })}
          />
        </>
      )}
    </div>
  );
}

export function resolveRange(entry: WidgetConfig, global: Range): Range {
  const o = entry.date_range_override;
  if (!o) return global;
  const r = periodRange(o.mode, o.from || global.from, o.to || global.to);
  return { from: r.from || global.from, to: r.to || global.to };
}

/* -------------------------------------------------------------------------- */
/* Widget shell                                                               */
/* -------------------------------------------------------------------------- */

export function WidgetShell({
  def,
  entry,
  global,
  editing,
  onChange,
  extraControls,
  children,
}: {
  def: WidgetDef;
  entry: WidgetConfig;
  global: Range;
  editing: boolean;
  onChange: (patch: Partial<WidgetConfig>) => void;
  extraControls?: React.ReactNode;
  children: (ctx: { range: Range; chartType: string | null }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.widget_key,
    disabled: !editing,
  });
  const range = useMemo(() => resolveRange(entry, global), [entry.date_range_override, global.from, global.to]);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${sizeClass(entry.size)} ${isDragging ? "z-10 opacity-70" : ""}`}
    >
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <div className="flex items-center gap-2">
            {editing && (
              <button
                type="button"
                aria-label={`Reorder ${def.label}`}
                className="cursor-grab text-muted-foreground hover:text-foreground"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
            <h3 className="text-base font-semibold">{def.label}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Select
                  value={entry.size}
                  onValueChange={(v) => onChange({ size: v as WidgetSize })}
                >
                  <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Widget size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
                {def.chartTypes.length > 0 && (
                  <ChartTypeToggle
                    value={entry.chart_type ?? def.defaultChartType ?? ""}
                    onChange={(v) => onChange({ chart_type: v })}
                    options={def.chartTypes}
                  />
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => onChange({ visible: false })}
                >
                  <EyeOff className="mr-1 h-3.5 w-3.5" />
                  Hide
                </Button>
              </>
            ) : (
              <>
                {def.supportsRange && <RangeControl entry={entry} onChange={onChange} />}
                {extraControls}
                {def.chartTypes.length > 0 && (
                  <ChartTypeToggle
                    value={entry.chart_type ?? def.defaultChartType ?? ""}
                    onChange={(v) => onChange({ chart_type: v })}
                    options={def.chartTypes}
                  />
                )}
              </>
            )}
          </div>
        </div>
        <CardContent className="p-4">
          {children({ range, chartType: entry.chart_type ?? def.defaultChartType })}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Grid + hidden widgets panel                                                */
/* -------------------------------------------------------------------------- */

export function WidgetGrid({
  order,
  editing,
  onReorder,
  children,
}: {
  order: string[];
  editing: boolean;
  onReorder: (next: string[]) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(order, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy} disabled={!editing}>
        <div className="grid gap-6 xl:grid-cols-4">{children}</div>
      </SortableContext>
    </DndContext>
  );
}

export function HiddenWidgetsPanel({
  config,
  onShow,
}: {
  config: WidgetConfig[];
  onShow: (key: string) => void;
}) {
  const hidden = config.filter((c) => !c.visible);
  if (hidden.length === 0) return null;
  return (
    <Card className="mb-6">
      <CardContent className="flex flex-wrap items-center gap-2 p-4">
        <span className="text-sm text-muted-foreground">Hidden widgets:</span>
        {hidden.map((c) => (
          <Button key={c.widget_key} size="sm" variant="outline" onClick={() => onShow(c.widget_key)}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            {defFor(c)?.label ?? c.widget_key}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

