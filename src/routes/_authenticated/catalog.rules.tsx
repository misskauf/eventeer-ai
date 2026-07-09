import { createFileRoute } from "@tanstack/react-router";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";

export const Route = createFileRoute("/_authenticated/catalog/rules")({
  component: RulesPage,
});

function RulesPage() {
  const { companyId } = useCurrentCompany();
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Seasons (price multipliers)</h2>
        <CrudList
          title="season"
          table="pricing_seasons"
          companyId={companyId}
          fields={[
            { name: "name", label: "Name" },
            { name: "start_date", label: "Start date" },
            { name: "end_date", label: "End date" },
            { name: "multiplier", label: "Multiplier (e.g. 1.25)", type: "number", step: "0.01" },
          ]}
          render={(r: any) => (
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {r.start_date} → {r.end_date} · ×{r.multiplier}
              </div>
            </div>
          )}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Minimum-revenue rules</h2>
        <CrudList
          title="rule"
          table="pricing_rules"
          companyId={companyId}
          fields={[
            { name: "name", label: "Name" },
            { name: "day_of_week", label: "Day of week (0=Sun … 6=Sat, blank = any)", type: "number" },
            { name: "min_revenue", label: "Minimum revenue required", type: "number", step: "0.01" },
          ]}
          render={(r: any) => (
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {r.day_of_week === null || r.day_of_week === undefined ? "Any day" : `Day ${r.day_of_week}`} · min ${Number(r.min_revenue).toLocaleString()}
              </div>
            </div>
          )}
        />
      </section>
    </div>
  );
}
