import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const { error, count } = await q.select("id", { count: "exact" });
    if (error) throw new Error(error.message);
    return { ok: true as const, updated: count ?? 0 };
  });
