import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const configSchema = z.object({
  doc_type: z.enum(["proposal", "contract"]),
  enabled: z.boolean(),
  mode: z.enum(["auto", "notify"]),
  channel: z.enum(["in_app", "email", "both"]),
  interval_days: z.number().int().min(1).max(180),
  max_reminders: z.number().int().min(1).max(20).nullable(),
});

/** Read the follow-up configuration rows for the caller's company. */
export const getFollowupConfigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ company_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("followup_configs")
      .select("doc_type, enabled, mode, channel, interval_days, max_reminders")
      .eq("company_id", data.company_id);
    if (error) throw new Error(error.message);
    return { configs: rows ?? [] };
  });

/** Upsert one document type's follow-up configuration. Requires settings edit. */
export const saveFollowupConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ company_id: z.string().uuid(), config: configSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requirePermission } = await import("@/lib/permissions.server");
    await requirePermission(context.supabase, data.company_id, "settings", "edit");

    const { error } = await context.supabase
      .from("followup_configs")
      .upsert(
        { company_id: data.company_id, ...data.config } as any,
        { onConflict: "company_id,doc_type" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
