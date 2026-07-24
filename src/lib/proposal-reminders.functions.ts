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
      .select("id, company_id, client_name, client_email, event_date")
      .eq("id", data.dealId)
      .maybeSingle();
    if (dealErr) throw new Error(dealErr.message);
    if (!deal) throw new Error("Deal not found");
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

    // Templated copy — English default. When a per-deal/company language field
    // exists, swap this for a language-keyed map.
    const clientFirstName = (deal.client_name ?? "").split(" ")[0] || "there";
    const subject = `Following up on your event proposal`;
    const bodyLines = [
      `Hi ${clientFirstName},`,
      ``,
      `Just checking in on the event proposal we shared with you${
        deal.event_date ? ` for ${new Date(deal.event_date).toLocaleDateString()}` : ""
      }.`,
      ``,
      `You can review it here: ${shareUrl}`,
      ``,
      `If you have any questions or would like adjustments, just reply to this email — happy to help.`,
      ``,
      `Thanks!`,
    ];
    const body = bodyLines.join("\n");

    // Send the client email + record activity + fire internal notification.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

    // Also read back the timestamp we just wrote so the UI can update.
    const { data: latest } = await supabaseAdmin
      .from("deal_activities")
      .select("created_at")
      .eq("deal_id", deal.id)
      .eq("kind", "proposal_reminder_sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { ok: true as const, sentAt: latest?.created_at ?? new Date().toISOString() };
  });
