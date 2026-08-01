import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
import { usePermissions } from "@/lib/use-permissions";
import type { Field } from "@/components/crud-list";

export const NON_OWNER_ROLES = [
  { value: "sales_manager", label: "Sales manager" },
  { value: "event_manager", label: "Event manager" },
  { value: "accounting", label: "Accounting" },
];

export { supabase };

/** Current user's role + company (kept for existing callers). */
export function useCompanyRole() {
  const { role, companyId, isOwner, loading } = usePermissions();
  return { role, companyId, loading, isOwner };
}

/**
 * True when the signed-in user may see internal costs and margins.
 * Driven by the Costs module in the permissions matrix (owner always passes).
 */
export function useCanViewCosts() {
  const { can, loading } = usePermissions();
  return { canViewCosts: can("costs", "view"), loading };
}

/** Internal cost form field, appended to a catalog CrudList field list. */
export function costField(label = "Internal cost"): Field {
  return {
    name: "cost",
    label,
    type: "number",
    step: "0.01",
    nullable: true,
    hint: "Internal only — not shown to clients. Same unit as the price above.",
  };
}

/** Cost + margin line for internal catalog lists. */
export function CostMargin({
  cost,
  price,
  currency,
  unit,
}: {
  cost: number | null | undefined;
  price: number | null | undefined;
  currency: string;
  unit?: string;
}) {
  const c = Number(cost ?? 0);
  const p = Number(price ?? 0);
  const margin = p - c;
  const pct = p > 0 ? (margin / p) * 100 : null;
  return (
    <div className="text-xs text-muted-foreground">
      <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Internal</span>{" "}
      Cost {money(c, currency)}
      {unit ? ` ${unit}` : ""} · Margin {money(margin, currency)}
      {pct != null ? ` (${pct.toFixed(1)}%)` : ""}
    </div>
  );
}
