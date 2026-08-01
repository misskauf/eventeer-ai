import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LEVEL_RANK,
  type PermissionLevel,
  type PermissionModule,
  type PermissionScope,
} from "@/lib/permissions";

type PermRow = { module: string; level: string; scope: string | null };

/**
 * Permissions for the signed-in user in their company.
 * Owner is a super-admin and short-circuits to full access everywhere.
 */
export function usePermissions() {
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [rows, setRows] = useState<PermRow[]>([]);
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
      const { data: ur } = await supabase
        .from("user_roles")
        .select("role, company_id, active")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      const active = (ur as any)?.active ?? true;
      setRole(active ? ((ur?.role as string) ?? null) : null);
      setCompanyId(ur?.company_id ?? null);
      if (ur?.company_id && ur?.role && active) {
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("module, level, scope")
          .eq("company_id", ur.company_id)
          .eq("role", ur.role);
        if (alive) setRows((perms as PermRow[]) ?? []);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const isOwner = role === "owner";

  const levels = Object.fromEntries(
    rows.map((r) => [r.module, r.level as PermissionLevel]),
  ) as Partial<Record<PermissionModule, PermissionLevel>>;

  function level(module: PermissionModule): PermissionLevel {
    if (isOwner) return "admin";
    return levels[module] ?? "none";
  }

  function can(module: PermissionModule, minLevel: PermissionLevel = "view"): boolean {
    if (isOwner) return true;
    return LEVEL_RANK[level(module)] >= LEVEL_RANK[minLevel];
  }

  function scope(module: PermissionModule): PermissionScope {
    if (isOwner) return "all";
    return ((rows.find((r) => r.module === module)?.scope as PermissionScope) ?? "all");
  }

  return { role, companyId, isOwner, levels, level, can, scope, loading };
}
