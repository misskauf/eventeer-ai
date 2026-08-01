import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CustomFilters, EngineDeal, EngineItem } from "@/lib/analytics-engine";
import { emptyFilters, hasActiveFilters } from "@/lib/dashboard-widgets";

export type Option = { value: string; label: string };

export type FilterOptions = {
  stages: Option[];
  spaces: Option[];
  owners: Option[];
  eventTypes: Option[];
  sources: Option[];
  packages: Option[];
};

type Group = { key: keyof CustomFilters; label: string; options: Option[] };

/** Applies per-card filters to the deal list (item-backed filters use snapshots). */
export function applyCardFilters(
  deals: EngineDeal[],
  items: EngineItem[],
  filters?: CustomFilters,
): EngineDeal[] {
  if (!hasActiveFilters(filters) || !filters) return deals;

  const spaceIds = new Set(filters.space_ids ?? []);
  const packageIds = new Set(filters.package_ids ?? []);
  const dealsWithSpace = new Set<string>();
  const dealsWithPackage = new Set<string>();
  if (spaceIds.size || packageIds.size) {
    for (const i of items) {
      if (spaceIds.size && i.space_id && spaceIds.has(i.space_id)) dealsWithSpace.add(i.deal_id);
      if (packageIds.size && i.item_type === "package" && i.item_id && packageIds.has(i.item_id))
        dealsWithPackage.add(i.deal_id);
    }
  }

  return deals.filter((d) => {
    if (filters.stages?.length && !filters.stages.includes(d.stage)) return false;
    if (filters.owner_ids?.length && !filters.owner_ids.includes(d.owner_id)) return false;
    if (filters.event_types?.length && !filters.event_types.includes(d.event_type ?? "")) return false;
    if (filters.sources?.length && !filters.sources.includes(d.source || "manual")) return false;
    if (spaceIds.size && !dealsWithSpace.has(d.id)) return false;
    if (packageIds.size && !dealsWithPackage.has(d.id)) return false;
    return true;
  });
}

export function CardFilters({
  value,
  onChange,
  options,
}: {
  value?: CustomFilters;
  onChange: (next: CustomFilters) => void;
  options: FilterOptions;
}) {
  const filters: CustomFilters = value ?? emptyFilters();
  const groups: Group[] = [
    { key: "stages", label: "Stage", options: options.stages },
    { key: "sources", label: "Source", options: options.sources },
    { key: "owner_ids", label: "Owner", options: options.owners },
    { key: "event_types", label: "Event type", options: options.eventTypes },
    { key: "space_ids", label: "Space", options: options.spaces },
    { key: "package_ids", label: "F&B package", options: options.packages },
  ];

  const active = groups.reduce((n, g) => n + ((filters[g.key] as string[] | undefined)?.length ?? 0), 0);

  const toggle = (key: keyof CustomFilters, v: string) => {
    const cur = (filters[key] as string[] | undefined) ?? [];
    onChange({
      ...filters,
      [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    } as CustomFilters);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={active ? "secondary" : "ghost"} className="h-8 px-2 text-xs">
          <Filter className="mr-1 h-3.5 w-3.5" />
          Filters
          {active > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {active}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Filter this card</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => onChange(emptyFilters())}
            disabled={active === 0}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>
        <ScrollArea className="max-h-80">
          <div className="space-y-3 p-3">
            {groups
              .filter((g) => g.options.length > 0)
              .map((g) => {
                const selected = (filters[g.key] as string[] | undefined) ?? [];
                return (
                  <div key={String(g.key)} className="space-y-1.5">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.options.map((o) => (
                        <Button
                          key={o.value}
                          size="sm"
                          variant={selected.includes(o.value) ? "secondary" : "outline"}
                          className="h-7 px-2 text-xs"
                          onClick={() => toggle(g.key, o.value)}
                        >
                          {o.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
