import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Send a follow-up email to the client for a sent, unanswered proposal.
 * Reuses the existing share token (so the client's proposal link stays valid),
 * records a `proposal_reminder_sent` deal_activity, and fires an internal
 * notification via notifyDeal.
 */
export const sendProposalReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ dealId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller can access the deal (RLS enforces company membership).
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select("id, company_id, client_name, client_email, event_date, language")
      .eq("id", data.dealId)
      .maybeSingle();
    if (dealErr) throw new Error(dealErr.message);
    if (!deal) throw new Error("Deal not found");
    {
      const { requirePermission } = await import("@/lib/permissions.server");
      await requirePermission(context.supabase, deal.company_id as string, "proposals", "edit");
    }

    if (!deal.client_email) throw new Error("This deal has no client email on file.");

    // Latest sent proposal
    const { data: proposal } = await supabase
      .from("proposals")
      .select("id, version, sent_at, constraints")
      .eq("deal_id", data.dealId)
      .not("sent_at", "is", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!proposal) throw new Error("No sent proposal to remind about.");

    const clientResponded =
      !!(proposal.constraints as any)?.client_response ||
      (await supabase
        .from("proposal_selections")
        .select("id")
        .eq("proposal_id", proposal.id)
        .limit(1)
        .maybeSingle()).data != null;
    if (clientResponded) throw new Error("Client already responded to this proposal.");

    // Reuse existing share token so the client's link stays valid.
    const { data: token } = await supabase
      .from("share_tokens")
      .select("token")
      .eq("proposal_id", proposal.id)
      .eq("kind", "client_proposal" as any)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!token) throw new Error("No share link found for this proposal.");

    const appOrigin = process.env.APP_URL ?? "";
    const shareUrl = appOrigin
      ? `${appOrigin.replace(/\/$/, "")}/p/${token.token}`
      : `/p/${token.token}`;

    // Templated copy in the deal's language (shared i18n resources).
    const { tFor } = await import("@/i18n");
    const tc = tFor((deal as any).language);
    const clientFirstName = (deal.client_name ?? "").split(" ")[0] || "there";
    const subject = tc("client.reminder_subject") as string;
    const bodyLines = [
      `${tc("client.reminder_greeting")} ${clientFirstName},`,
      ``,
      `${tc("client.reminder_body_line")}${
        deal.event_date ? ` (${new Date(deal.event_date).toLocaleDateString()})` : ""
      }.`,
      ``,
      `${tc("client.reminder_view_here")} ${shareUrl}`,
      ``,
      `${tc("client.reminder_reply_note")}`,
      ``,
      `${tc("client.reminder_thanks")}`,
    ];
    const body = bodyLines.join("\n");

    // Send the client email + record activity + fire internal notification.
    const { sendClientEmailAndNotify } = await import("@/lib/notifications.server");
    await sendClientEmailAndNotify({
      companyId: deal.company_id,
      dealId: deal.id,
      toEmail: deal.client_email,
      subject,
      body,
      shareUrl,
      internalTitle: `Reminder sent to ${deal.client_name}`,
      internalBody: `Follow-up email sent for proposal v${proposal.version}.`,
      activityMeta: {
        proposal_id: proposal.id,
        version: proposal.version,
        sent_to: deal.client_email,
        share_url: shareUrl,
        by_user: userId,
      },
    });

    return { ok: true as const, sentAt: new Date().toISOString() };
  });

