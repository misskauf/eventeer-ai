// Server-only notification helper. Never imported from the client bundle.
// Load via dynamic import inside server-fn handlers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotifyKind =
  | "lead_created"
  | "client_confirmed"
  | "client_requested_changes"
  | "client_declined"
  | "contract_signed"
  | (string & {});

export type NotifyDealInput = {
  companyId: string;
  dealId: string | null;
  kind: NotifyKind;
  title: string;
  body?: string;
  /** When omitted, recipient defaults to the deal's owner_id (or company-wide if the deal has no owner). */
  recipientUserId?: string | null;
  /** Extra structured payload stored on the deal_activities row. */
  meta?: Record<string, unknown>;
};

async function resolveRecipient(
  input: NotifyDealInput,
): Promise<{ recipientUserId: string | null; recipientEmail: string | null; companyEmail: string | null }> {
  let recipientUserId = input.recipientUserId ?? null;
  let dealOwnerId: string | null = null;

  if (input.dealId && recipientUserId === undefined) {
    // (kept for safety) — undefined branch never runs due to default null.
  }

  if (input.dealId && !recipientUserId) {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("owner_id")
      .eq("id", input.dealId)
      .maybeSingle();
    dealOwnerId = (deal?.owner_id as string | null) ?? null;
    recipientUserId = dealOwnerId;
  }

  let recipientEmail: string | null = null;
  if (recipientUserId) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(recipientUserId);
      recipientEmail = data.user?.email ?? null;
    } catch (err) {
      console.warn("[notifyDeal] getUserById failed", err);
    }
  }

  let companyEmail: string | null = null;
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("contact_email")
    .eq("id", input.companyId)
    .maybeSingle();
  companyEmail = ((company as any)?.contact_email as string | null) ?? null;

  return { recipientUserId, recipientEmail, companyEmail };
}

async function sendResendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[notifyDeal] RESEND_API_KEY or RESEND_FROM_EMAIL not set; skipping email");
    return;
  }
  const to = Array.from(new Set(opts.to.filter(Boolean)));
  if (to.length === 0) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[notifyDeal] Resend failed [${res.status}]: ${text}`);
    }
  } catch (err) {
    console.warn("[notifyDeal] Resend threw", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmail(title: string, body: string, dealUrl: string | null): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br />");
  const cta = dealUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(dealUrl)}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Open deal</a></p>`
    : "";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f7f8;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px 0;color:#0f172a">${safeTitle}</h2>
    <div style="color:#334155;font-size:14px;line-height:1.5">${safeBody}</div>
    ${cta}
  </div>
</body></html>`;
}

/** Insert notification + activity row and fire the notification email (best-effort). */
export async function notifyDeal(input: NotifyDealInput): Promise<void> {
  const { recipientUserId, recipientEmail, companyEmail } = await resolveRecipient(input);

  const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
    company_id: input.companyId,
    deal_id: input.dealId,
    recipient_user_id: recipientUserId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? "",
  } as any);
  if (notifErr) console.warn("[notifyDeal] insert notification failed", notifErr);

  if (input.dealId) {
    const { error: actErr } = await supabaseAdmin.from("deal_activities").insert({
      deal_id: input.dealId,
      company_id: input.companyId,
      kind: input.kind,
      meta: { title: input.title, body: input.body ?? "", ...(input.meta ?? {}) } as any,
    } as any);
    if (actErr) console.warn("[notifyDeal] insert activity failed", actErr);
  }

  const appOrigin = process.env.APP_URL ?? "";
  const dealUrl = input.dealId && appOrigin ? `${appOrigin.replace(/\/$/, "")}/deals/${input.dealId}` : null;

  await sendResendEmail({
    to: [recipientEmail ?? "", companyEmail ?? ""].filter(Boolean) as string[],
    subject: input.title,
    html: renderEmail(input.title, input.body ?? "", dealUrl),
  });
}

/**
 * Send an email directly to the client (external recipient) AND log an
 * internal deal_activity + in-app notification for the deal owner.
 * Used by the proposal reminder flow.
 */
export async function sendClientEmailAndNotify(input: {
  companyId: string;
  dealId: string;
  toEmail: string;
  subject: string;
  body: string;
  shareUrl: string;
  internalTitle: string;
  internalBody?: string;
  activityMeta?: Record<string, unknown>;
}): Promise<void> {
  // 1. Email the client (external).
  await sendResendEmail({
    to: [input.toEmail],
    subject: input.subject,
    html: renderEmail(input.subject, input.body, input.shareUrl),
  });

  // 2. Record the deal activity so "last reminded on" can be shown.
  const { error: actErr } = await supabaseAdmin.from("deal_activities").insert({
    deal_id: input.dealId,
    company_id: input.companyId,
    kind: "proposal_reminder_sent",
    meta: {
      title: input.internalTitle,
      body: input.internalBody ?? "",
      to: input.toEmail,
      share_url: input.shareUrl,
      ...(input.activityMeta ?? {}),
    } as any,
  } as any);
  if (actErr) console.warn("[sendClientEmailAndNotify] activity insert failed", actErr);

  // 3. In-app bell notification for the deal owner.
  const { recipientUserId } = await resolveRecipient({
    companyId: input.companyId,
    dealId: input.dealId,
    kind: "proposal_reminder_sent",
    title: input.internalTitle,
  });
  const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
    company_id: input.companyId,
    deal_id: input.dealId,
    recipient_user_id: recipientUserId,
    kind: "proposal_reminder_sent",
    title: input.internalTitle,
    body: input.internalBody ?? "",
  } as any);
  if (notifErr) console.warn("[sendClientEmailAndNotify] notification insert failed", notifErr);
}


/** Send a plain HTML email (already-rendered body) via Resend. Server-only. */
export async function sendHtmlEmail(opts: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  await sendResendEmail(opts);
}
