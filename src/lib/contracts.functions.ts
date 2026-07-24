// Public + authenticated server fns for the contract signing lifecycle.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function randomToken(len = 32) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const PUBLIC_CONTRACT_FIELDS =
  "id, deal_id, company_id, template_name, rendered_body, status, sent_at, signed_at, signed_by_name, signed_by_email, signed_place, signature_data, signing_token_expires_at";

/** Public: fetch a contract by its signing token (for the client signing page). */
export const getContractByToken = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().min(16) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contract } = await supabaseAdmin
      .from("contracts")
      .select(PUBLIC_CONTRACT_FIELDS)
      .eq("signing_token", data.token)
      .maybeSingle();
    if (!contract) return { ok: false as const, reason: "not_found" };
    if (
      contract.signing_token_expires_at &&
      new Date(contract.signing_token_expires_at as string) < new Date()
    )
      return { ok: false as const, reason: "expired" };
    if (contract.status !== "sent" && contract.status !== "signed")
      return { ok: false as const, reason: "not_available" };

    const [{ data: company }, { data: deal }] = await Promise.all([
      supabaseAdmin
        .from("companies")
        .select("id, name, logo_url, primary_color")
        .eq("id", contract.company_id)
        .maybeSingle(),
      supabaseAdmin
        .from("deals")
        .select("id, client_name, client_company, event_date, guest_count")
        .eq("id", contract.deal_id)
        .maybeSingle(),
    ]);
    return { ok: true as const, contract, company, deal };
  });

/** Public: client signs the contract by drawing/typing their signature. */
export const signContract = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(16),
        typed_name: z.string().trim().min(2).max(200),
        signed_place: z.string().trim().min(1).max(200),
        signed_date: z.string().min(4).max(40),
        signature_image: z.string().startsWith("data:image/").max(2_000_000),
        agreed: z.literal(true),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contract } = await supabaseAdmin
      .from("contracts")
      .select("id, deal_id, company_id, status, sent_to_email, signing_token_expires_at, rendered_body")
      .eq("signing_token", data.token)
      .maybeSingle();
    if (!contract) throw new Error("Invalid signing link");
    if (contract.status === "signed") throw new Error("Contract already signed");
    if (contract.status !== "sent") throw new Error("Contract is not available for signing");
    if (
      contract.signing_token_expires_at &&
      new Date(contract.signing_token_expires_at as string) < new Date()
    )
      throw new Error("Signing link has expired");

    const ip =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      getRequestHeader("cf-connecting-ip") ??
      null;
    const now = new Date().toISOString();

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const imgTag = `<img src="${data.signature_image}" alt="Signature" style="max-height:60px"/>`;
    const nameEsc = esc(data.typed_name);
    const placeEsc = esc(data.signed_place);
    const dateEsc = esc(data.signed_date);

    const body = (contract.rendered_body as string) ?? "";
    const hasPlaceholder = /\{\{\s*client_signature(_name|_date|_place)?\s*\}\}/i.test(body);
    let signedBody = body;
    if (hasPlaceholder) {
      signedBody = body
        .replace(/\{\{\s*client_signature\s*\}\}/gi, imgTag)
        .replace(/\{\{\s*client_signature_name\s*\}\}/gi, nameEsc)
        .replace(/\{\{\s*client_signature_date\s*\}\}/gi, dateEsc)
        .replace(/\{\{\s*client_signature_place\s*\}\}/gi, placeEsc);
    } else {
      signedBody =
        body +
        `<hr/><div style="margin-top:16px"><p style="margin:0 0 4px;font-size:12px;color:#555">Client signature</p>` +
        `<p style="margin:0 0 8px">${imgTag}</p>` +
        `<p style="margin:0">Name: ${nameEsc}</p>` +
        `<p style="margin:0">Place: ${placeEsc}</p>` +
        `<p style="margin:0">Date: ${dateEsc}</p></div>`;
    }

    const { error } = await supabaseAdmin
      .from("contracts")
      .update({
        status: "signed",
        signed_at: now,
        signed_by_name: data.typed_name,
        signed_by_email: contract.sent_to_email,
        signed_place: data.signed_place,
        signed_ip: ip,
        signature_data: data.signature_image,
        rendered_body: signedBody,
        signing_token: null,
        signing_token_expires_at: null,
      } as any)
      .eq("id", contract.id);
    if (error) throw new Error(error.message);

    const { notifyDeal } = await import("@/lib/notifications.server");
    await notifyDeal({
      companyId: contract.company_id as string,
      dealId: contract.deal_id as string,
      kind: "contract_signed",
      title: `Contract signed by ${data.typed_name}`,
      body: `The client signed the contract at ${new Date(now).toLocaleString()}.`,
      meta: { contract_id: contract.id, signed_by_name: data.typed_name },
    });

    return {
      ok: true as const,
      signed_at: now,
      signed_by_name: data.typed_name,
      signed_place: data.signed_place,
      signed_date: data.signed_date,
      signature_image: data.signature_image,
    };
  });

/** Manager: mint a signing token and mark contract as sent. Returns the signing URL. */
export const sendContractToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        contract_id: z.string().uuid(),
        to_email: z.string().email(),
        expires_in_days: z.number().int().min(1).max(365).default(30),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: contract, error: fetchErr } = await context.supabase
      .from("contracts")
      .select("id, status, signing_token, signing_token_expires_at")
      .eq("id", data.contract_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!contract) throw new Error("Contract not found");
    if (contract.status === "signed") throw new Error("Contract already signed");
    if (contract.status === "voided") throw new Error("Contract has been voided");

    // Reuse existing token if still valid; otherwise mint a new one.
    let token = contract.signing_token as string | null;
    let expiresAt = contract.signing_token_expires_at as string | null;
    const needsNew =
      !token ||
      !expiresAt ||
      new Date(expiresAt) < new Date();
    if (needsNew) {
      token = randomToken(32);
      expiresAt = new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000).toISOString();
    }

    const { error } = await context.supabase
      .from("contracts")
      .update({
        status: "sent",
        sent_at: contract.status === "sent" ? undefined : new Date().toISOString(),
        sent_to_email: data.to_email,
        signing_token: token,
        signing_token_expires_at: expiresAt,
      } as any)
      .eq("id", data.contract_id);
    if (error) throw new Error(error.message);

    return { ok: true as const, token, expires_at: expiresAt };
  });

/** Manager: mark a contract signed manually (offline signature). */
export const markContractSignedManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        contract_id: z.string().uuid(),
        signed_by_name: z.string().trim().min(1).max(200),
        signed_by_email: z.string().email().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: contract } = await context.supabase
      .from("contracts")
      .select("id, deal_id, company_id, status")
      .eq("id", data.contract_id)
      .maybeSingle();
    if (!contract) throw new Error("Contract not found");
    if (contract.status === "signed") throw new Error("Contract already signed");

    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("contracts")
      .update({
        status: "signed",
        signed_at: now,
        signed_by_name: data.signed_by_name,
        signed_by_email: data.signed_by_email ?? null,
        signature_data: `${data.signed_by_name} (recorded manually)`,
        signing_token: null,
        signing_token_expires_at: null,
      } as any)
      .eq("id", data.contract_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("deal_activities").insert({
      deal_id: contract.deal_id,
      company_id: contract.company_id,
      actor_id: context.userId,
      kind: "contract_signed_manually",
      meta: { contract_id: contract.id, signed_by_name: data.signed_by_name },
    });

    return { ok: true as const, signed_at: now };
  });

/** Manager: void a sent/signed contract (soft cancel, keeps the row for history). */
export const voidContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ contract_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: contract } = await context.supabase
      .from("contracts")
      .select("id, deal_id, company_id, status")
      .eq("id", data.contract_id)
      .maybeSingle();
    if (!contract) throw new Error("Contract not found");

    const { error } = await context.supabase
      .from("contracts")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        voided_by: context.userId,
        signing_token: null,
        signing_token_expires_at: null,
      } as any)
      .eq("id", data.contract_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("deal_activities").insert({
      deal_id: contract.deal_id,
      company_id: contract.company_id,
      actor_id: context.userId,
      kind: "contract_voided",
      meta: { contract_id: contract.id },
    });

    return { ok: true as const };
  });
