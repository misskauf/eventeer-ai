import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  normalizeFields,
  splitDealVsCustom,
  validateSubmission,
  type LeadFieldsConfig,
} from "./lead-forms";

/** Server-local publishable Supabase client (no user session) for public reads. */
function publicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Public: resolve an active lead form by slug (branded info + fields). */
export const resolveLeadForm = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const supa = publicClient();
    const { data: form, error } = await supa
      .from("lead_forms")
      .select("id, company_id, name, slug, fields, intro_text, success_text, redirect_url, consent_text, active")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!form) throw new Error("Form not found");
    const { data: company } = await supa
      .from("companies")
      .select("id, name, logo_url, primary_color")
      .eq("id", form.company_id as string)
      .maybeSingle();
    return {
      form: { ...form, fields: normalizeFields((form as any).fields) as LeadFieldsConfig },
      company: company ?? null,
    };
  });

/** Public: submit a lead form -> creates a deal + activity + notification. */
export const submitLeadForm = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().min(1).max(200),
        values: z.record(z.string(), z.unknown()).default({}),
        consent: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (!data.consent) throw new Error("Consent required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: form, error: formErr } = await supabaseAdmin
      .from("lead_forms")
      .select("id, company_id, fields, success_text, redirect_url, consent_text, active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (formErr) throw new Error(formErr.message);
    if (!form || !(form as any).active) throw new Error("Form not available");

    const fields = normalizeFields((form as any).fields);
    const values = validateSubmission(fields, data.values as Record<string, unknown>);
    const { dealPatch, customFields } = splitDealVsCustom(fields, values);

    // Default owner = company's created_by
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("created_by")
      .eq("id", (form as any).company_id as string)
      .maybeSingle();
    const ownerId = (company as any)?.created_by as string | null;
    if (!ownerId) throw new Error("No default owner for this company");

    // Compose notes: preset message + phone (kept for backward-compat visibility)
    const messagePart = typeof dealPatch["notes"] === "string" ? String(dealPatch["notes"]) : null;
    const legacyMessage = (values["message"] as string | undefined) ?? null;
    const phone = (values["phone"] as string | undefined) ?? null;
    const notesParts: string[] = [];
    if (phone) notesParts.push(`Phone: ${phone}`);
    if (legacyMessage) notesParts.push(legacyMessage);
    if (!legacyMessage && messagePart) notesParts.push(messagePart);
    const notes = notesParts.join("\n\n") || null;

    const clientName = String(dealPatch["client_name"] ?? "").trim();
    const clientEmail = String(dealPatch["client_email"] ?? "").trim();

    const insertRow: Record<string, unknown> = {
      company_id: (form as any).company_id,
      owner_id: ownerId,
      client_name: clientName,
      client_email: clientEmail,
      client_company: (dealPatch["client_company"] as string | undefined) ?? null,
      event_type: (dealPatch["event_type"] as string | undefined) ?? null,
      event_date: (dealPatch["event_date"] as string | undefined) ?? null,
      guest_count: (dealPatch["guest_count"] as number | undefined) ?? 0,
      notes,
      stage: "new",
      source: "lead_form",
      lead_form_id: (form as any).id,
      consent_text: (form as any).consent_text ?? null,
      consent_given_at: new Date().toISOString(),
      custom_fields: customFields,
    };

    const { data: deal, error: dealErr } = await supabaseAdmin
      .from("deals")
      .insert(insertRow as any)
      .select("id, company_id, guest_count, event_type, event_date")
      .single();
    if (dealErr || !deal) throw new Error(dealErr?.message ?? "Failed to create deal");

    await supabaseAdmin.from("deal_activities").insert({
      deal_id: deal.id,
      company_id: deal.company_id,
      actor_id: ownerId,
      kind: "deal_created",
      meta: { via: "lead_form", form_id: (form as any).id, form_slug: data.slug },
    } as any);

    let draftCreated = false;
    try {
      const { buildSuggestedProposal } = await import("@/lib/lead-suggest.server");
      const res = await buildSuggestedProposal(deal.company_id as string, {
        id: deal.id as string,
        company_id: deal.company_id as string,
        guest_count: (deal as any).guest_count ?? 0,
        event_type: (deal as any).event_type ?? null,
        event_date: (deal as any).event_date ?? null,
      });
      draftCreated = res.created;
    } catch (err) {
      console.warn("[submitLeadForm] buildSuggestedProposal failed", err);
    }

    try {
      const { notifyDeal } = await import("@/lib/notifications.server");
      await notifyDeal({
        companyId: deal.company_id as string,
        dealId: deal.id as string,
        kind: "lead_created",
        title: `New lead: ${clientName}`,
        body:
          `${clientName}${dealPatch["client_company"] ? ` (${dealPatch["client_company"]})` : ""} — ${clientEmail}${dealPatch["event_date"] ? ` — ${dealPatch["event_date"]}` : ""}` +
          (draftCreated ? `\n\nA suggested draft proposal is ready to review.` : ""),
      });
    } catch (err) {
      console.warn("[submitLeadForm] notifyDeal failed", err);
    }


    return {
      ok: true as const,
      success_text: (form as any).success_text ?? null,
      redirect_url: (form as any).redirect_url ?? null,
    };
  });
