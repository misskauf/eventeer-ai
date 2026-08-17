// Server-only scan + dispatch for per-document client follow-ups.
// Called from the daily job route (src/routes/api/public/hooks/followups.ts).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendHtmlEmail } from "@/lib/notifications.server";
import {
  followupActivityKind,
  legacyFollowupKinds,
  type FollowupChannel,
  type FollowupConfig,
  type FollowupDocType,
} from "@/lib/followups";

const JOB_NAME = "client_followups";
const LEASE_MINUTES = 10;
/** Hard cap on follow-ups dispatched per run (protects against backlog storms). */
const MAX_ITEMS_PER_RUN = 50;
/** How many candidate documents we scan per run. */
const SCAN_LIMIT = 400;

const DEAD_STAGES = new Set([
  "lost",
  "accepted",
  "signed",
  "client_approved",
  "waiting_payment",
  "invoice_sent",
  "downpayment_received",
  "paid_in_full",
]);

type Lang = "en" | "de";

const COPY: Record<FollowupDocType, Record<Lang, { subject: string; body: (name: string, url: string) => string }>> = {
  proposal: {
    en: {
      subject: "A quick follow-up on your event proposal",
      body: (name, url) =>
        `Hi ${name},\n\nJust checking in on the proposal we sent for your event — we'd love to hear your thoughts.\n\nYou can review it here: ${url}\n\nSimply reply to this email if anything should be adjusted.\n\nThank you!`,
    },
    de: {
      subject: "Kurze Nachfrage zu Ihrem Veranstaltungsangebot",
      body: (name, url) =>
        `Hallo ${name},\n\nwir wollten kurz nachfragen, ob Sie unser Angebot für Ihre Veranstaltung schon ansehen konnten.\n\nHier können Sie es einsehen: ${url}\n\nAntworten Sie einfach auf diese E-Mail, wenn etwas angepasst werden soll.\n\nVielen Dank!`,
    },
  },
  contract: {
    en: {
      subject: "A quick reminder to sign your event agreement",
      body: (name, url) =>
        `Hi ${name},\n\nYour event agreement is still waiting for a signature.\n\nYou can review and sign it here: ${url}\n\nJust reply to this email if you have any questions.\n\nThank you!`,
    },
    de: {
      subject: "Erinnerung: Ihre Veranstaltungsvereinbarung wartet auf Unterschrift",
      body: (name, url) =>
        `Hallo ${name},\n\nIhre Veranstaltungsvereinbarung wartet noch auf Ihre Unterschrift.\n\nHier können Sie sie prüfen und unterschreiben: ${url}\n\nBei Fragen antworten Sie gerne einfach auf diese E-Mail.\n\nVielen Dank!`,
    },
  },
};

const DOC_LABEL: Record<FollowupDocType, string> = { proposal: "proposal", contract: "contract" };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmail(title: string, body: string, url: string | null, cta: string): string {
  const button = url
    ? `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(cta)}</a></p>`
    : "";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f7f8;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px 0;color:#0f172a">${escapeHtml(title)}</h2>
    <div style="color:#334155;font-size:14px;line-height:1.5">${escapeHtml(body).replace(/\n/g, "<br />")}</div>
    ${button}
  </div>
</body></html>`;
}

function appOrigin(): string {
  return (process.env.APP_URL ?? "").replace(/\/$/, "");
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

/** Single-flight lease. Returns false when another run holds the lease. */
async function acquireLease(): Promise<boolean> {
  const now = new Date();
  const until = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();

  const { data: existing } = await supabaseAdmin
    .from("job_leases")
    .select("job_name, locked_until")
    .eq("job_name", JOB_NAME)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabaseAdmin
      .from("job_leases")
      .insert({ job_name: JOB_NAME, locked_until: until, last_run_at: now.toISOString() } as any);
    return !error;
  }

  if (new Date((existing as any).locked_until as string) > now) return false;

  const { data: updated, error } = await supabaseAdmin
    .from("job_leases")
    .update({ locked_until: until, last_run_at: now.toISOString() } as any)
    .eq("job_name", JOB_NAME)
    .lt("locked_until", now.toISOString())
    .select("job_name");
  return !error && (updated?.length ?? 0) > 0;
}

async function releaseLease(): Promise<void> {
  await supabaseAdmin
    .from("job_leases")
    .update({ locked_until: new Date().toISOString() } as any)
    .eq("job_name", JOB_NAME);
}

type Candidate = {
  doc: FollowupDocType;
  companyId: string;
  dealId: string;
  clientName: string;
  clientEmail: string | null;
  ownerId: string | null;
  language: string | null;
  sentAt: string;
  clientUrl: string | null;
  meta: Record<string, unknown>;
};

async function loadConfigs(): Promise<Map<string, FollowupConfig>> {
  const { data } = await supabaseAdmin
    .from("followup_configs")
    .select("company_id, doc_type, enabled, mode, channel, interval_days, max_reminders")
    .eq("enabled", true);
  const map = new Map<string, FollowupConfig>();
  for (const row of (data ?? []) as any[]) {
    if (row.doc_type !== "proposal" && row.doc_type !== "contract") continue;
    map.set(`${row.company_id}:${row.doc_type}`, row as FollowupConfig);
  }
  return map;
}

async function loadDeals(dealIds: string[]) {
  if (dealIds.length === 0) return new Map<string, any>();
  const { data } = await supabaseAdmin
    .from("deals")
    .select("id, company_id, owner_id, client_name, client_email, stage, archived_at, language")
    .in("id", dealIds);
  return new Map<string, any>(((data ?? []) as any[]).map((d) => [d.id as string, d]));
}

/** Follow-up history per deal for a doc type: count + latest timestamp. */
async function loadHistory(doc: FollowupDocType, dealIds: string[]) {
  const kinds = [followupActivityKind(doc), ...legacyFollowupKinds(doc)];
  const out = new Map<string, { count: number; last: string | null }>();
  if (dealIds.length === 0) return out;
  const { data } = await supabaseAdmin
    .from("deal_activities")
    .select("deal_id, created_at, kind")
    .in("deal_id", dealIds)
    .in("kind", kinds)
    .order("created_at", { ascending: false });
  for (const row of (data ?? []) as any[]) {
    const prev = out.get(row.deal_id as string);
    if (!prev) out.set(row.deal_id as string, { count: 1, last: row.created_at as string });
    else prev.count += 1;
  }
  return out;
}

async function proposalCandidates(configs: Map<string, FollowupConfig>): Promise<Candidate[]> {
  const { data: proposals } = await supabaseAdmin
    .from("proposals")
    .select("id, deal_id, company_id, version, sent_at, constraints")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: true })
    .limit(SCAN_LIMIT);

  // Keep only the newest version per deal, in a company with proposal follow-ups enabled.
  const latest = new Map<string, any>();
  for (const p of (proposals ?? []) as any[]) {
    if (!configs.has(`${p.company_id}:proposal`)) continue;
    const prev = latest.get(p.deal_id as string);
    if (!prev || (p.version as number) > (prev.version as number)) latest.set(p.deal_id as string, p);
  }
  const rows = [...latest.values()].filter((p) => !(p.constraints as any)?.client_response);
  if (rows.length === 0) return [];

  const { data: selections } = await supabaseAdmin
    .from("proposal_selections")
    .select("proposal_id")
    .in("proposal_id", rows.map((p) => p.id as string));
  const answered = new Set(((selections ?? []) as any[]).map((s) => s.proposal_id as string));

  const { data: tokens } = await supabaseAdmin
    .from("share_tokens")
    .select("token, proposal_id")
    .eq("kind", "client_proposal" as any)
    .in("proposal_id", rows.map((p) => p.id as string));
  const tokenByProposal = new Map<string, string>();
  for (const t of ((tokens ?? []) as any[])) tokenByProposal.set(t.proposal_id as string, t.token as string);

  const deals = await loadDeals(rows.map((p) => p.deal_id as string));
  const origin = appOrigin();

  return rows
    .filter((p) => !answered.has(p.id as string))
    .map((p) => {
      const deal = deals.get(p.deal_id as string);
      if (!deal || deal.archived_at || DEAD_STAGES.has(deal.stage as string)) return null;
      const token = tokenByProposal.get(p.id as string);
      return {
        doc: "proposal" as const,
        companyId: p.company_id as string,
        dealId: p.deal_id as string,
        clientName: (deal.client_name as string) ?? "",
        clientEmail: (deal.client_email as string) ?? null,
        ownerId: (deal.owner_id as string) ?? null,
        language: (deal.language as string) ?? null,
        sentAt: p.sent_at as string,
        clientUrl: token && origin ? `${origin}/p/${token}` : null,
        meta: { proposal_id: p.id, version: p.version },
      } satisfies Candidate;
    })
    .filter(Boolean) as Candidate[];
}

async function contractCandidates(configs: Map<string, FollowupConfig>): Promise<Candidate[]> {
  const { data: contracts } = await supabaseAdmin
    .from("contracts")
    .select("id, deal_id, company_id, sent_at, sent_to_email, signed_at, voided_at, signing_token, signing_token_expires_at")
    .not("sent_at", "is", null)
    .is("signed_at", null)
    .is("voided_at", null)
    .order("sent_at", { ascending: true })
    .limit(SCAN_LIMIT);

  const rows = ((contracts ?? []) as any[]).filter((c) => configs.has(`${c.company_id}:contract`));
  if (rows.length === 0) return [];

  const deals = await loadDeals(rows.map((c) => c.deal_id as string));
  const origin = appOrigin();

  return rows
    .map((c) => {
      const deal = deals.get(c.deal_id as string);
      if (!deal || deal.archived_at || (deal.stage as string) === "lost") return null;
      const tokenValid =
        !!c.signing_token &&
        (!c.signing_token_expires_at || new Date(c.signing_token_expires_at as string) > new Date());
      return {
        doc: "contract" as const,
        companyId: c.company_id as string,
        dealId: c.deal_id as string,
        clientName: (deal.client_name as string) ?? "",
        clientEmail: (c.sent_to_email as string) ?? (deal.client_email as string) ?? null,
        ownerId: (deal.owner_id as string) ?? null,
        language: (deal.language as string) ?? null,
        sentAt: c.sent_at as string,
        clientUrl: tokenValid && origin ? `${origin}/c/${c.signing_token}` : null,
        meta: { contract_id: c.id },
      } satisfies Candidate;
    })
    .filter(Boolean) as Candidate[];
}

async function internalRecipients(
  companyId: string,
  ownerId: string | null,
): Promise<string[]> {
  const emails: string[] = [];
  if (ownerId) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(ownerId);
      if (data.user?.email) emails.push(data.user.email);
    } catch (err) {
      console.warn("[followups] getUserById failed", err);
    }
  }
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("contact_email")
    .eq("id", companyId)
    .maybeSingle();
  const contact = (company as any)?.contact_email as string | null;
  if (contact) emails.push(contact);
  return Array.from(new Set(emails.filter(Boolean)));
}

async function notifyInternal(
  c: Candidate,
  channel: FollowupChannel,
  title: string,
  body: string,
): Promise<void> {
  if (channel === "in_app" || channel === "both") {
    const { error } = await supabaseAdmin.from("notifications").insert({
      company_id: c.companyId,
      deal_id: c.dealId,
      recipient_user_id: c.ownerId,
      kind: `${c.doc}_followup_due`,
      title,
      body,
    } as any);
    if (error) console.warn("[followups] notification insert failed", error);
  }
  if (channel === "email" || channel === "both") {
    const to = await internalRecipients(c.companyId, c.ownerId);
    const origin = appOrigin();
    await sendHtmlEmail({
      to,
      subject: title,
      html: renderEmail(title, body, origin ? `${origin}/deals/${c.dealId}` : null, "Open deal"),
    });
  }
}

async function dispatch(c: Candidate, cfg: FollowupConfig): Promise<"auto" | "notify"> {
  const lang: Lang = (c.language ?? "en").toLowerCase().startsWith("de") ? "de" : "en";
  const label = DOC_LABEL[c.doc];
  const canAutoSend = cfg.mode === "auto" && !!c.clientEmail && !!c.clientUrl;

  if (canAutoSend) {
    const copy = COPY[c.doc][lang];
    const firstName = (c.clientName ?? "").split(" ")[0] || (lang === "de" ? "Gast" : "there");
    await sendHtmlEmail({
      to: [c.clientEmail as string],
      subject: copy.subject,
      html: renderEmail(
        copy.subject,
        copy.body(firstName, c.clientUrl as string),
        c.clientUrl,
        lang === "de" ? "Ansehen" : "View",
      ),
    });
    // Internal copy so the team can see it went out.
    await notifyInternal(
      c,
      cfg.channel,
      `Follow-up sent to ${c.clientName}`,
      `An automatic ${label} follow-up email was sent to ${c.clientEmail}.`,
    );
  } else {
    await notifyInternal(
      c,
      cfg.channel,
      `Time to follow up with ${c.clientName}`,
      cfg.mode === "auto"
        ? `The ${label} for this deal needs a follow-up, but no client link or email was available — please reach out manually.`
        : `No response to the ${label} for ${Math.floor(daysSince(c.sentAt))} days. Please contact the client.`,
    );
  }

  const { error } = await supabaseAdmin.from("deal_activities").insert({
    deal_id: c.dealId,
    company_id: c.companyId,
    kind: followupActivityKind(c.doc),
    meta: {
      doc_type: c.doc,
      mode: canAutoSend ? "auto" : "notify",
      channel: cfg.channel,
      to: canAutoSend ? c.clientEmail : null,
      ...c.meta,
    } as any,
  } as any);
  if (error) console.warn("[followups] activity insert failed", error);

  return canAutoSend ? "auto" : "notify";
}

export type FollowupRunResult = {
  skipped?: "locked";
  scanned: number;
  sent: number;
  notified: number;
};

export async function runFollowups(): Promise<FollowupRunResult> {
  const got = await acquireLease();
  if (!got) return { skipped: "locked", scanned: 0, sent: 0, notified: 0 };

  try {
    const configs = await loadConfigs();
    if (configs.size === 0) return { scanned: 0, sent: 0, notified: 0 };

    const candidates = [...(await proposalCandidates(configs)), ...(await contractCandidates(configs))];

    const histories = new Map<FollowupDocType, Map<string, { count: number; last: string | null }>>();
    for (const doc of ["proposal", "contract"] as FollowupDocType[]) {
      const ids = candidates.filter((c) => c.doc === doc).map((c) => c.dealId);
      histories.set(doc, await loadHistory(doc, ids));
    }

    let sent = 0;
    let notified = 0;
    for (const c of candidates) {
      if (sent + notified >= MAX_ITEMS_PER_RUN) break;
      const cfg = configs.get(`${c.companyId}:${c.doc}`);
      if (!cfg) continue;
      const hist = histories.get(c.doc)?.get(c.dealId) ?? { count: 0, last: null };
      if (cfg.max_reminders != null && hist.count >= cfg.max_reminders) continue;
      if (daysSince(hist.last ?? c.sentAt) < cfg.interval_days) continue;

      try {
        const outcome = await dispatch(c, cfg);
        if (outcome === "auto") sent += 1;
        else notified += 1;
      } catch (err) {
        console.warn("[followups] dispatch failed", c.doc, c.dealId, err);
      }
    }

    return { scanned: candidates.length, sent, notified };
  } finally {
    await releaseLease();
  }
}
