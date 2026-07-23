import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeFields, type LeadFieldsConfig } from "./lead-forms";

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
        values: z
          .object({
            name: z.string().trim().max(200).optional(),
            email: z.string().trim().email().max(255).optional(),
            phone: z.string().trim().max(50).optional(),
            company: z.string().trim().max(200).optional(),
            event_type: z.string().trim().max(100).optional(),
            event_date: z.string().trim().max(30).optional(),
            guest_count: z.number().int().min(0).max(1000000).optional(),
            message: z.string().trim().max(4000).optional(),
          })
          .default({}),
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

    // Required-field validation
    const v = data.values;
    const missing: string[] = [];
    for (const [k, cfg] of Object.entries(fields)) {
      if (!cfg.enabled || !cfg.required) continue;
      const val = (v as any)[k];
      if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) missing.push(k);
    }
    // Name + email always required to create a deal
    if (!v.name || v.name.trim() === "") missing.push("name");
    if (!v.email || v.email.trim() === "") missing.push("email");
    if (missing.length) throw new Error(`Missing required fields: ${Array.from(new Set(missing)).join(", ")}`);

    // Default owner = company's created_by
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("created_by")
      .eq("id", (form as any).company_id as string)
      .maybeSingle();
    const ownerId = (company as any)?.created_by as string | null;
    if (!ownerId) throw new Error("No default owner for this company");

    const notesParts: string[] = [];
    if (v.phone) notesParts.push(`Phone: ${v.phone}`);
    if (v.message) notesParts.push(v.message);
    const notes = notesParts.join("\n\n") || null;

    const { data: deal, error: dealErr } = await supabaseAdmin
      .from("deals")
      .insert({
        company_id: (form as any).company_id,
        owner_id: ownerId,
        client_name: v.name!.trim(),
        client_email: v.email!.trim(),
        client_company: v.company?.trim() || null,
        event_type: v.event_type?.trim() || null,
        event_date: v.event_date || null,
        guest_count: v.guest_count ?? 0,
        notes,
        stage: "new" as any,
        source: "lead_form",
        lead_form_id: (form as any).id,
        consent_text: (form as any).consent_text ?? null,
        consent_given_at: new Date().toISOString(),
      } as any)
      .select("id, company_id")
      .single();
    if (dealErr || !deal) throw new Error(dealErr?.message ?? "Failed to create deal");

    await supabaseAdmin.from("deal_activities").insert({
      deal_id: deal.id,
      company_id: deal.company_id,
      actor_id: ownerId,
      kind: "deal_created",
      meta: { via: "lead_form", form_id: (form as any).id, form_slug: data.slug },
    } as any);

    try {
      const { notifyDeal } = await import("@/lib/notifications.server");
      await notifyDeal({
        companyId: deal.company_id as string,
        dealId: deal.id as string,
        kind: "lead_created",
        title: `New lead: ${v.name}`,
        body: `${v.name}${v.company ? ` (${v.company})` : ""} — ${v.email}${v.event_date ? ` — ${v.event_date}` : ""}`,
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
