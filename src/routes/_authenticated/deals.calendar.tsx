import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { DealsTabs } from "@/components/deals-tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  STAGE_ORDER,
  stageCalendarToneClass,
  stageLabel,
} from "@/lib/deal-stages";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/deals/calendar")({
  component: DealsCalendarPage,
});

type CalDeal = {
  id: string;
  client_name: string;
  client_company: string | null;
  event_date: string;
  stage: string;
};

function DealsCalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [deals, setDeals] = useState<CalDeal[]>([]);
  const navigate = useNavigate();

  const rangeStart = useMemo(() => startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), [cursor]);
  const rangeEnd = useMemo(() => endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }), [cursor]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, client_name, client_company, event_date, stage")
        .not("event_date", "is", null)
        .gte("event_date", format(rangeStart, "yyyy-MM-dd"))
        .lte("event_date", format(rangeEnd, "yyyy-MM-dd"));
      setDeals((data as CalDeal[]) ?? []);
    })();
  }, [rangeStart, rangeEnd]);

  const dealsByDay = useMemo(() => {
    const m = new Map<string, CalDeal[]>();
    for (const d of deals) {
      const arr = m.get(d.event_date) ?? [];
      arr.push(d);
      m.set(d.event_date, arr);
    }
    return m;
  }, [deals]);

  const days: Date[] = [];
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <AppShell>
      <PageHeader title="Deals" description="All events on the calendar, colored by stage." />
      <DealsTabs />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
        </div>
        <div className="text-lg font-medium">{format(cursor, "MMMM yyyy")}</div>
        <div className="w-[140px]" />
      </div>

      <div className="rounded-lg border bg-background">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          {weekdayLabels.map((w) => (
            <div key={w} className="px-2 py-2 text-center font-medium">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, cursor);
            const dayDeals = dealsByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={cn(
                  "min-h-[110px] border-b border-r p-1.5 text-xs",
                  !inMonth && "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn("font-medium", !inMonth && "opacity-60")}>{format(day, "d")}</span>
                </div>
                <div className="space-y-1">
                  {dayDeals.map((d) => {
                    const label = d.client_company
                      ? `${d.client_company} · ${d.client_name}`
                      : d.client_name;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => navigate({ to: "/deals/$id", params: { id: d.id } })}
                        title={`${label} — ${stageLabel(d.stage)}`}
                        className={cn(
                          "block w-full truncate rounded border px-1.5 py-1 text-left text-[11px] leading-tight hover:opacity-90",
                          stageCalendarToneClass(d.stage),
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {STAGE_ORDER.map((s) => (
          <span
            key={s}
            className={cn(
              "inline-flex items-center rounded border px-2 py-0.5",
              stageCalendarToneClass(s),
            )}
          >
            {stageLabel(s)}
          </span>
        ))}
      </div>
    </AppShell>
  );
}
