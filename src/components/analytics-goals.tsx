import { Link } from "@tanstack/react-router";
import { money } from "@/lib/pricing";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/analytics-widgets";
import {
  METRIC_LABEL,
  STATUS_LABEL,
  computeGoalProgress,
  periodLabel,
  type Goal,
  type GoalDeal,
  type GoalItem,
} from "@/lib/goals";

const STATUS_CLASS: Record<string, string> = {
  ahead: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  on_track: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  done: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  behind: "border-destructive/40 text-destructive",
  not_started: "text-muted-foreground",
};

export function GoalsCard({
  goals,
  deals,
  items,
  currency,
  ownerName,
  spaceName,
  onDrilldown,
}: {
  goals: Goal[];
  deals: GoalDeal[];
  items: GoalItem[];
  currency: string;
  ownerName: (id: string) => string;
  spaceName: (id: string) => string;
  onDrilldown?: (title: string, dealIds: string[]) => void;
}) {
  if (!goals.length)
    return (
      <div className="space-y-3">
        <EmptyState label="No revenue goals for this period." />
        <div className="text-center text-xs text-muted-foreground">
          <Link to="/settings/goals" className="underline">
            Set targets in Settings → Revenue goals
          </Link>
        </div>
      </div>
    );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {goals.map((goal) => {
        const p = computeGoalProgress({ goal, deals, items });
        const scope =
          [goal.owner_id ? ownerName(goal.owner_id) : null, goal.space_id ? spaceName(goal.space_id) : null]
            .filter(Boolean)
            .join(" · ") || "Whole company";
        const title = `${METRIC_LABEL[goal.metric]} — ${periodLabel(goal.period_start, goal.period_type)}`;
        return (
          <button
            key={goal.id}
            type="button"
            className="rounded-md border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => onDrilldown?.(title, p.dealIds)}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{METRIC_LABEL[goal.metric]}</div>
                <div className="text-xs text-muted-foreground">
                  {periodLabel(goal.period_start, goal.period_type)} · {scope}
                </div>
              </div>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                  STATUS_CLASS[p.status] ?? "text-muted-foreground"
                }`}
              >
                {STATUS_LABEL[p.status]}
              </span>
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
              <div className="text-xl font-semibold tabular-nums">{money(p.actual, currency)}</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                of {money(p.target, currency)}
              </div>
            </div>

            <Progress value={Math.min(100, Math.max(0, p.pct))} className="mt-2 h-2" />

            <div className="mt-2 text-xs text-muted-foreground">
              {p.pct.toFixed(0)}% of goal
              {p.elapsedPct > 0 && p.elapsedPct < 100
                ? ` · ${p.elapsedPct.toFixed(0)}% of the period elapsed`
                : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
