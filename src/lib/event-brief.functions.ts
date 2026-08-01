import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Company members (default: managers) that a brief can be sent to. */
export const listBriefRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ company_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("company_id", data.company_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership) throw new Error("Not a member of this company");

    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("company_id", data.company_id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const recipients: { user_id: string; role: string; email: string }[] = [];
    for (const r of roles ?? []) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id as string);
        const email = u.user?.email;
        if (email) recipients.push({ user_id: r.user_id as string, role: String(r.role), email });
      } catch {
        /* ignore */
      }
    }
    return { recipients };
  });

/** Emails the brief body to a chosen recipient and logs a deal_activities row. */
export const sendBriefToManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        deal_id: z.string().uuid(),
        to_email: z.string().email(),
        message: z.string().max(2000).optional(),
        body_html: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: deal, error } = await context.supabase
      .from("deals")
      .select("id, company_id, client_name, event_date, event_type")
      .eq("id", data.deal_id)
      .maybeSingle();
    if (error || !deal) throw new Error("Deal not found or not accessible");

    const { data: brief } = await context.supabase
      .from("event_briefs")
      .select("id")
      .eq("deal_id", data.deal_id)
      .maybeSingle();

    const { renderBriefEmailHtml, briefEmailSubject } = await import("@/lib/event-brief-email");
    const subject = briefEmailSubject({
      clientName: (deal.client_name as string | null) ?? "Event",
      eventDate: (deal.event_date as string | null) ?? null,
    });

    const appOrigin = process.env["APP_URL"] ?? "";
    const dealUrl = appOrigin ? `${appOrigin.replace(/\/$/, "")}/deals/${deal.id}` : null;

    const { sendHtmlEmail } = await import("@/lib/notifications.server");
    await sendHtmlEmail({
      to: [data.to_email],
      subject,
      html: renderBriefEmailHtml({
        title: subject,
        message: data.message ?? "",
        bodyHtml: data.body_html,
        dealUrl,
      }),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("deal_activities").insert({
      deal_id: deal.id,
      company_id: deal.company_id,
      kind: "brief_sent",
      meta: {
        title: subject,
        to: data.to_email,
        message: data.message ?? "",
        brief_id: brief?.id ?? null,
      } as any,
    } as any);

    return { ok: true as const };
  });
