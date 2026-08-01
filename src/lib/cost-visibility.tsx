import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
import type { Field } from "@/components/crud-list";

export const NON_OWNER_ROLES = [
  { value: "manager", label: "Manager" },
  { value: "sales", label: "Sales manager" },
  { value: "accounting", label: "Accounting" },
];

/** Current user's role in their company + which roles may see internal costs. */
export function useCompanyRole() {
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [visibleRoles, setVisibleRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        if (alive) setLoading(false);
        return;
      }
      const { data: r } = await supabase
        .from("user_roles")
        .select("role, company_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      setRole((r?.role as string) ?? null);
      setCompanyId(r?.company_id ?? null);
      if (r?.company_id) {
        const { data: c } = await supabase
          .from("companies")
          .select("cost_visible_roles")
          .eq("id", r.company_id)
          .maybeSingle();
        if (alive) setVisibleRoles(((c as any)?.cost_visible_roles as string[]) ?? []);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { role, companyId, visibleRoles, loading, isOwner: role === "owner" };
}

/** True when the signed-in user may see internal costs and margins. */
export function useCanViewCosts() {
  const { role, visibleRoles, loading } = useCompanyRole();
  const canViewCosts = role === "owner" || (!!role && visibleRoles.includes(role));
  return { canViewCosts, loading };
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
