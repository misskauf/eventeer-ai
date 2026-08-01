import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { money } from "@/lib/pricing";
import { stageLabel } from "@/lib/deal-stages";
import { toCsv, downloadCsv } from "@/lib/analytics-export";

export type DrilldownDeal = {
  id: string;
  client_name?: string | null;
  stage: string;
  estimated_value: number;
  created_at: string;
  event_date: string | null;
};

export type Drilldown = { title: string; deals: DrilldownDeal[] } | null;

export function DealDrilldownSheet({
  drilldown,
  onOpenChange,
  currency,
}: {
  drilldown: Drilldown;
  onOpenChange: (open: boolean) => void;
  currency: string;
}) {
  const deals = drilldown?.deals ?? [];
  const total = deals.reduce((s, d) => s + Number(d.estimated_value || 0), 0);

  return (
    <Sheet open={Boolean(drilldown)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{drilldown?.title ?? "Deals"}</SheetTitle>
          <SheetDescription>
            {deals.length} deal{deals.length === 1 ? "" : "s"} · {money(total, currency)} total value
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <Button
            size="sm"
            variant="outline"
            disabled={deals.length === 0}
            onClick={() =>
              downloadCsv(
                `${(drilldown?.title ?? "deals").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`,
                toCsv(
                  ["Client", "Stage", "Created", "Event date", "Value"],
                  deals.map((d) => [
                    d.client_name ?? d.id,
                    stageLabel(d.stage),
                    d.created_at.slice(0, 10),
                    d.event_date ?? "",
                    String(d.estimated_value ?? 0),
                  ]),
                ),
              )
            }
          >
            Export CSV
          </Button>
        </div>

        <ScrollArea className="mt-3 h-[calc(100vh-11rem)]">
          <div className="space-y-2 px-4 pb-6">
            {deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals in this selection.</p>
            ) : (
              deals.map((d) => (
                <Link
                  key={d.id}
                  to="/deals/$id"
                  params={{ id: d.id }}
                  className="block rounded-md border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {d.client_name || `Deal ${d.id.slice(0, 8)}…`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created {d.created_at.slice(0, 10)}
                        {d.event_date ? ` · Event ${d.event_date}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {money(Number(d.estimated_value || 0), currency)}
                      </div>
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {stageLabel(d.stage)}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
