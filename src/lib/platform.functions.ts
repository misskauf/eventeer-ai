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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  stripe_price_id: string | null;
  stripe_coupon_id: string | null;
  user_count: number;
  last_activity: string | null;
};

export type PlatformPrice = {
  id: string;
  stripe_price_id: string;
  label: string;
  amount_cents: number;
  currency: string;
  interval: string;
  active: boolean;
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
        .select(
          "id, name, created_at, trial_ends_at, subscription_status, activated_at, billing_note, stripe_customer_id, stripe_subscription_id, current_period_end, stripe_price_id, stripe_coupon_id",
        )
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

/** Subscription plans the platform can assign to a company. */
export const listPlatformPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ prices: PlatformPrice[]; defaultPriceId: string | null }> => {
    await assertPlatformAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_prices" as never)
      .select("id, stripe_price_id, label, amount_cents, currency, interval, active")
      .order("amount_cents", { ascending: true });
    if (error) throw new Error(error.message);
    const { defaultPriceId } = await import("@/lib/platform-stripe.server");
    return { prices: (data as any[] as PlatformPrice[]) ?? [], defaultPriceId: defaultPriceId() };
  });

/** Add or update a plan in the platform price list (validated against Stripe). */
export const savePlatformPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        stripePriceId: z.string().min(3).max(200),
        label: z.string().min(1).max(120),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase);
    const { platformStripe } = await import("@/lib/platform-stripe.server");
    const price = await platformStripe<any>(`/prices/${data.stripePriceId}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_prices" as never).upsert(
      {
        stripe_price_id: data.stripePriceId,
        label: data.label,
        amount_cents: price?.unit_amount ?? 0,
        currency: (price?.currency ?? "eur").toUpperCase(),
        interval: price?.recurring?.interval ?? "month",
        active: data.active ?? true,
      } as never,
      { onConflict: "stripe_price_id" } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Assign a specific price and/or coupon to one company; applies to the next checkout. */
export const setCompanyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        companyId: z.string().uuid(),
        priceId: z.string().max(200).nullable(),
        couponId: z.string().max(200).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("companies")
      .update({
        stripe_price_id: data.priceId || null,
        stripe_coupon_id: data.couponId || null,
      } as never)
      .eq("id", data.companyId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("platform_audit").insert({
      company_id: data.companyId,
      actor_id: context.userId,
      action: "plan_assigned",
      detail: { price_id: data.priceId, coupon_id: data.couponId },
    } as never);

    return { ok: true };
  });
