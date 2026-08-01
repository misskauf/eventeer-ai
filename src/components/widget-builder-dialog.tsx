import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CustomWidgetView } from "@/components/analytics-custom-widget";
import { newCustomWidget } from "@/lib/dashboard-widgets";
import {
  CHART_TYPES,
  DIMENSIONS,
  MEASURES,
  incompatibleReason,
  isItemDimension,
  suggestedTitle,
  type ChartType,
  type CustomWidget,
  type Dimension,
  type EngineActivity,
  type EngineDeal,
  type EngineItem,
  type Measure,
} from "@/lib/analytics-engine";

export type BuilderOption = { value: string; label: string };

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: BuilderOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0)
    return <p className="text-xs text-muted-foreground">No options available.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          size="sm"
          variant={selected.includes(o.value) ? "secondary" : "outline"}
          className="h-7 px-2 text-xs"
          onClick={() => onToggle(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function WidgetBuilderDialog({
  open,
  onOpenChange,
  initial,
  initialChartType,
  onSave,
  deals,
  activities,
  items,
  currency,
  canViewCosts,
  hasItems,
  globalRange,
  stageOptions,
  spaceOptions,
  ownerOptions,
  eventTypeOptions,
  ownerLabel,
  stageLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: CustomWidget;
  initialChartType?: string | null;
  onSave: (custom: CustomWidget, chartType: string) => void;
  deals: EngineDeal[];
  activities: EngineActivity[];
  items: EngineItem[];
  currency: string;
  canViewCosts: boolean;
  hasItems: boolean;
  globalRange: { from: string; to: string };
  stageOptions: BuilderOption[];
  spaceOptions: BuilderOption[];
  ownerOptions: BuilderOption[];
  eventTypeOptions: BuilderOption[];
  ownerLabel?: (id: string) => string;
  stageLabel?: (stage: string) => string;
}) {
  const [draft, setDraft] = useState<CustomWidget>(() => initial ?? newCustomWidget());
  const [chartType, setChartType] = useState<string>(initialChartType ?? "bar");
  const [titleTouched, setTitleTouched] = useState(Boolean(initial));
  const [rangeMode, setRangeMode] = useState(initialChartType === undefined ? "global" : "global");
  const [from, setFrom] = useState(globalRange.from);
  const [to, setTo] = useState(globalRange.to);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? newCustomWidget());
    setChartType(initialChartType ?? (initial?.dimension === "none" ? "kpi" : "bar"));
    setTitleTouched(Boolean(initial));
    setRangeMode("global");
    setFrom(globalRange.from);
    setTo(globalRange.to);
  }, [open]);

  const availableMeasures = useMemo(
    () => MEASURES.filter((m) => (m.requiresCosts ? canViewCosts : true)),
    [canViewCosts],
  );

  const previewRange = rangeMode === "custom" ? { from, to } : globalRange;

  function patch(next: Partial<CustomWidget>) {
    setDraft((d) => {
      const merged = { ...d, ...next, filters: { ...d.filters, ...(next.filters ?? {}) } };
      if (!titleTouched) merged.title = suggestedTitle(merged.measure, merged.dimension);
      return merged;
    });
  }

  function setMeasure(m: Measure) {
    patch({ measure: m });
    if (incompatibleReason(m, draft.dimension)) patch({ dimension: "month" });
  }

  function setDimension(d: Dimension) {
    patch({ dimension: d });
    if (d === "none") setChartType("kpi");
    else if (chartType === "kpi") setChartType("bar");
  }

  const toggle = (field: keyof CustomWidget["filters"]) => (value: string) => {
    const cur = draft.filters[field];
    patch({
      filters: {
        ...draft.filters,
        [field]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      },
    });
  };

  const chartOptions = CHART_TYPES.filter((c) =>
    draft.dimension === "none" ? c.value === "kpi" || c.value === "table" : true,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit widget" : "New widget"}</DialogTitle>
          <DialogDescription>
            Pick a measure, a breakdown and a chart type. The preview uses your real data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wb-title">Title</Label>
              <Input
                id="wb-title"
                value={draft.title}
                onChange={(e) => {
                  setTitleTouched(true);
                  setDraft((d) => ({ ...d, title: e.target.value }));
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Measure</Label>
              <Select value={draft.measure} onValueChange={(v) => setMeasure(v as Measure)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMeasures.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Break down by</Label>
              <Select value={draft.dimension} onValueChange={(v) => setDimension(v as Dimension)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIMENSIONS.map((d) => {
                    const reason =
                      incompatibleReason(draft.measure, d.value) ??
                      (isItemDimension(d.value) && !hasItems
                        ? "Needs item analytics — rebuild first"
                        : null);
                    return (
                      <SelectItem key={d.value} value={d.value} disabled={Boolean(reason)}>
                        {d.label}
                        {reason ? ` — ${reason}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Chart type</Label>
              <div className="flex flex-wrap gap-1.5">
                {chartOptions.map((c) => (
                  <Button
                    key={c.value}
                    type="button"
                    size="sm"
                    variant={chartType === c.value ? "secondary" : "outline"}
                    className="h-7 px-2 text-xs"
                    onClick={() => setChartType(c.value as ChartType)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Date range</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={rangeMode} onValueChange={setRangeMode}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global period</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
                {rangeMode === "custom" && (
                  <>
                    <Input
                      type="date"
                      aria-label="From"
                      className="h-8 w-[140px] text-xs"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                    <Input
                      type="date"
                      aria-label="To"
                      className="h-8 w-[140px] text-xs"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Saved widgets follow the dashboard period; you can override it on the card.
              </p>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Filters
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stage</Label>
                <Chips
                  options={stageOptions}
                  selected={draft.filters.stages}
                  onToggle={toggle("stages")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Space</Label>
                <Chips
                  options={spaceOptions}
                  selected={draft.filters.space_ids}
                  onToggle={toggle("space_ids")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Owner</Label>
                <Chips
                  options={ownerOptions}
                  selected={draft.filters.owner_ids}
                  onToggle={toggle("owner_ids")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Event type</Label>
                <Chips
                  options={eventTypeOptions}
                  selected={draft.filters.event_types}
                  onToggle={toggle("event_types")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-sm font-semibold">{draft.title}</div>
                <CustomWidgetView
                  custom={draft}
                  chartType={chartType}
                  range={previewRange}
                  deals={deals}
                  activities={activities}
                  items={items}
                  currency={currency}
                  ownerLabel={ownerLabel}
                  stageLabel={stageLabel}
                  compact
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft, chartType)}>
            {initial ? "Save changes" : "Add widget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
