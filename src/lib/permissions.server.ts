import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { LEVEL_RANK, type PermissionLevel, type PermissionModule, type PermissionScope } from "@/lib/permissions";

type Client = SupabaseClient<Database>;

/** Company the signed-in user belongs to (first membership). */
export async function getCallerCompanyId(supabase: Client, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("company_id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return data?.company_id ?? null;
}

/** Effective level for the caller on a module ('admin' for owners). */
export async function getPermissionLevel(
  supabase: Client,
  companyId: string,
  module: PermissionModule,
): Promise<PermissionLevel> {
  const { data, error } = await supabase.rpc("permission_level", {
    _company_id: companyId,
    _module: module,
  });
  if (error) throw new Error(`Permission check failed: ${error.message}`);
  return ((data as string) ?? "none") as PermissionLevel;
}

/** Throws when the caller lacks at least `minLevel` on `module`. */
export async function requirePermission(
  supabase: Client,
  companyId: string,
  module: PermissionModule,
  minLevel: PermissionLevel,
): Promise<PermissionLevel> {
  const level = await getPermissionLevel(supabase, companyId, module);
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) {
    throw new Error(`Forbidden: ${module} requires ${minLevel} access`);
  }
  return level;
}

/** Record scope for a module: owners and unset rows default to 'all'. */
export async function getPermissionScope(
  supabase: Client,
  companyId: string,
  userId: string,
  module: PermissionModule,
): Promise<PermissionScope> {
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();
  if (!role?.role || role.role === "owner") return "all";
  const { data } = await supabase
    .from("role_permissions")
    .select("scope")
    .eq("company_id", companyId)
    .eq("role", role.role)
    .eq("module", module)
    .maybeSingle();
  return (data?.scope as PermissionScope) ?? "all";
}

/** Append a row to the permission audit trail (service role). */
export async function logPermissionAudit(input: {
  companyId: string;
  actorId: string | null;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("permission_audit").insert({
    company_id: input.companyId,
    actor_id: input.actorId,
    action: input.action,
    target: input.target ?? null,
    detail: (input.detail ?? {}) as never,
  });
  if (error) console.error("[permission_audit]", error.message);
}
