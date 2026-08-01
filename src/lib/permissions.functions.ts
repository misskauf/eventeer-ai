import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEVELS, MODULES } from "@/lib/permissions";

const roleSchema = z.enum(["sales_manager", "event_manager", "accounting"]);
const moduleSchema = z.enum(MODULES as unknown as [string, ...string[]]);
const levelSchema = z.enum(LEVELS as unknown as [string, ...string[]]);

/** Full permission matrix for the caller's company (requires team view). */
export const getPermissionMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCallerCompanyId, requirePermission } = await import("@/lib/permissions.server");
    const companyId = await getCallerCompanyId(context.supabase, context.userId);
    if (!companyId) throw new Error("No company found for this user");
    const level = await requirePermission(context.supabase, companyId, "team", "view");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("role_permissions")
      .select("role, module, level, scope")
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { companyId, canEdit: level === "admin", rows: data ?? [] };
  });

/** Persist matrix changes and record each one in permission_audit. */
export const savePermissionMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        changes: z
          .array(
            z.object({
              role: roleSchema,
              module: moduleSchema,
              level: levelSchema,
              scope: z.enum(["own", "all"]).nullable().optional(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getCallerCompanyId, requirePermission, logPermissionAudit } = await import(
      "@/lib/permissions.server"
    );
    const companyId = await getCallerCompanyId(context.supabase, context.userId);
    if (!companyId) throw new Error("No company found for this user");
    await requirePermission(context.supabase, companyId, "team", "admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before, error: beforeErr } = await supabaseAdmin
      .from("role_permissions")
      .select("role, module, level, scope")
      .eq("company_id", companyId);
    if (beforeErr) throw new Error(beforeErr.message);
    const prev = new Map(
      (before ?? []).map((r: any) => [`${r.role}:${r.module}`, { level: r.level, scope: r.scope }]),
    );

    const applied: Array<Record<string, unknown>> = [];
    for (const c of data.changes) {
      const key = `${c.role}:${c.module}`;
      const old = prev.get(key) ?? { level: "none", scope: null };
      const scope = c.scope ?? null;
      if (old.level === c.level && (old.scope ?? null) === scope) continue;

      const { error } = await supabaseAdmin
        .from("role_permissions")
        .upsert(
          {
            company_id: companyId,
            role: c.role as never,
            module: c.module,
            level: c.level,
            scope,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "company_id,role,module" },
        );
      if (error) throw new Error(error.message);

      applied.push({ role: c.role, module: c.module, from: old, to: { level: c.level, scope } });
      await logPermissionAudit({
        companyId,
        actorId: context.userId,
        action: "permission_changed",
        target: key,
        detail: {
          role: c.role,
          module: c.module,
          from_level: old.level,
          to_level: c.level,
          from_scope: old.scope ?? null,
          to_scope: scope,
        },
      });
    }

    return { ok: true as const, changed: applied.length };
  });

/** Recent permission / user changes for the caller's company. */
export const listPermissionAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { getCallerCompanyId, requirePermission } = await import("@/lib/permissions.server");
    const companyId = await getCallerCompanyId(context.supabase, context.userId);
    if (!companyId) throw new Error("No company found for this user");
    await requirePermission(context.supabase, companyId, "team", "view");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("permission_audit")
      .select("id, actor_id, action, target, detail, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { entries: rows ?? [] };
  });
