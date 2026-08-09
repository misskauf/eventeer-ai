import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** True when the caller is a platform admin (checked with the caller's own client). */
export const checkPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_platform_admin");
    return { isPlatformAdmin: data === true };
  });

type RpcClient = { rpc: (fn: "is_platform_admin") => PromiseLike<{ data: unknown }> };

async function assertPlatformAdmin(supabase: RpcClient) {
  const { data } = await supabase.rpc("is_platform_admin");
  if (data !== true) throw new Error("Forbidden");
}

export type PlatformCompany = {
  id: string;
  name: string;
  created_at: string;
  trial_ends_at: string | null;
  subscription_status: string;
  activated_at: string | null;
  billing_note: string | null;
  user_count: number;
  last_activity: string | null;
};

/** All companies with billing state, member counts and last deal activity. */
export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ companies: PlatformCompany[] }> => {
    await assertPlatformAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [companiesRes, rolesRes, dealsRes] = await Promise.all([
      supabaseAdmin
        .from("companies")
        .select("id, name, created_at, trial_ends_at, subscription_status, activated_at, billing_note")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("company_id, user_id, active"),
      supabaseAdmin.from("deals").select("company_id, updated_at"),
    ]);
    if (companiesRes.error) throw new Error(companiesRes.error.message);

    const counts = new Map<string, Set<string>>();
    for (const r of rolesRes.data ?? []) {
      if (r.active === false) continue;
      const set = counts.get(r.company_id) ?? new Set<string>();
      set.add(r.user_id);
      counts.set(r.company_id, set);
    }
    const lastActivity = new Map<string, string>();
    for (const d of dealsRes.data ?? []) {
      const prev = lastActivity.get(d.company_id);
      if (!prev || d.updated_at > prev) lastActivity.set(d.company_id, d.updated_at);
    }

    return {
      companies: (companiesRes.data ?? []).map((c) => ({
        ...c,
        user_count: counts.get(c.id)?.size ?? 0,
        last_activity: lastActivity.get(c.id) ?? null,
      })) as PlatformCompany[],
    };
  });

/** Recent platform actions for one company. */
export const getCompanyAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("platform_audit")
      .select("id, action, detail, created_at")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const actionSchema = z.object({
  companyId: z.string().uuid(),
  action: z.enum(["activate", "extend_trial", "comp", "lock"]),
  note: z.string().max(500).optional(),
  days: z.number().int().min(1).max(3650).optional(),
});

/** Single entry point for all platform billing actions; every call is logged. */
export const setCompanyBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => actionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company, error: readErr } = await supabaseAdmin
      .from("companies")
      .select("id, subscription_status, trial_ends_at")
      .eq("id", data.companyId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!company) throw new Error("Company not found");

    const patch: {
      subscription_status: string;
      activated_at?: string;
      billing_note?: string;
      trial_ends_at?: string;
    } = { subscription_status: company.subscription_status };
    if (data.action === "activate") {
      if (!data.note?.trim()) throw new Error("A note is required when activating an account");
      patch.subscription_status = "active";
      patch.activated_at = new Date().toISOString();
      patch.billing_note = data.note.trim();
    } else if (data.action === "extend_trial") {
      const days = data.days ?? 30;
      const base = company.trial_ends_at ? new Date(company.trial_ends_at) : new Date();
      const from = base.getTime() > Date.now() ? base : new Date();
      patch.subscription_status = "trialing";
      patch.trial_ends_at = new Date(from.getTime() + days * 86_400_000).toISOString();
      if (data.note?.trim()) patch.billing_note = data.note.trim();
    } else if (data.action === "comp") {
      patch.subscription_status = "comped";
      if (data.note?.trim()) patch.billing_note = data.note.trim();
    } else {
      patch.subscription_status = "expired";
      if (data.note?.trim()) patch.billing_note = data.note.trim();
    }

    const { error: upErr } = await supabaseAdmin
      .from("companies")
      .update(patch)
      .eq("id", data.companyId);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("platform_audit").insert({
      company_id: data.companyId,
      actor_id: context.userId,
      action: data.action,
      detail: {
        note: data.note?.trim() ?? null,
        days: data.action === "extend_trial" ? (data.days ?? 30) : null,
        previous_status: company.subscription_status,
        new_status: patch.subscription_status,
      },
    });

    return { ok: true };
  });
