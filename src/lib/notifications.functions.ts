import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Called from client right after a deal insert; verifies membership then fans out notify. */
export const notifyLeadCreated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ deal_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: deal, error } = await context.supabase
      .from("deals")
      .select("id, company_id, client_name, client_email, client_company")
      .eq("id", data.deal_id)
      .maybeSingle();
    if (error || !deal) throw new Error("Deal not found or not accessible");
    const { notifyDeal } = await import("@/lib/notifications.server");
    await notifyDeal({
      companyId: deal.company_id as string,
      dealId: deal.id as string,
      kind: "lead_created",
      title: `New lead: ${deal.client_name}`,
      body: `${deal.client_name}${deal.client_company ? ` (${deal.client_company})` : ""} — ${deal.client_email}`,
    });
    return { ok: true as const };
  });

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ limit: z.number().int().min(1).max(100).default(20) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("notifications")
      .select("id, deal_id, kind, title, body, read_at, created_at, recipient_user_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { notifications: rows ?? [] };
  });

export const getUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        ids: z.array(z.string().uuid()).optional(),
        all: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    let q = context.supabase.from("notifications").update({ read_at: now } as any).is("read_at", null);
    if (!data.all) {
      if (!data.ids || data.ids.length === 0) return { ok: true as const, updated: 0 };
      q = q.in("id", data.ids);
    }
    const { error, data: updated } = await q.select("id");
    if (error) throw new Error(error.message);
    return { ok: true as const, updated: updated?.length ?? 0 };
  });
