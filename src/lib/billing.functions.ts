// Subscription billing for the signed-in venue (platform Stripe, hosted Checkout).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SubscriptionInfo = {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  has_subscription: boolean;
  has_customer: boolean;
  plan_label: string | null;
  billing_configured: boolean;
};

/** Subscription state for the caller's company (owner-safe, no secrets). */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionInfo> => {
    const { getCallerCompanyId } = await import("@/lib/permissions.server");
    const companyId = await getCallerCompanyId(context.supabase, context.userId);
    if (!companyId) throw new Error("No workspace found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select(
        "subscription_status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, stripe_price_id",
      )
      .eq("id", companyId)
      .maybeSingle();
    const c = company as any;

    let planLabel: string | null = null;
    const priceId = c?.stripe_price_id ?? null;
    if (priceId) {
      const { data: price } = await supabaseAdmin
        .from("platform_prices" as never)
        .select("label")
        .eq("stripe_price_id", priceId)
        .maybeSingle();
      planLabel = (price as any)?.label ?? null;
    }

    const { defaultPriceId } = await import("@/lib/platform-stripe.server");
    return {
      status: c?.subscription_status ?? "active",
      trial_ends_at: c?.trial_ends_at ?? null,
      current_period_end: c?.current_period_end ?? null,
      has_subscription: !!c?.stripe_subscription_id,
      has_customer: !!c?.stripe_customer_id,
      plan_label: planLabel,
      billing_configured: !!process.env["PLATFORM_STRIPE_SECRET_KEY"] && !!(priceId ?? defaultPriceId()),
    };
  });

/** Start hosted Checkout for the subscription. Owners only. */
export const startSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getCallerCompanyId } = await import("@/lib/permissions.server");
    const companyId = await getCallerCompanyId(context.supabase, context.userId);
    if (!companyId) throw new Error("No workspace found");

    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("company_id", companyId)
      .eq("active", true)
      .maybeSingle();
    if ((role as any)?.role !== "owner") throw new Error("Only the account owner can manage billing.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, contact_email, stripe_customer_id, stripe_price_id, stripe_coupon_id")
      .eq("id", companyId)
      .maybeSingle();
    const c = company as any;
    if (!c) throw new Error("Company not found");

    const { ensureCustomer, createSubscriptionCheckout, defaultPriceId } = await import(
      "@/lib/platform-stripe.server"
    );
    const priceId = c.stripe_price_id ?? defaultPriceId();
    if (!priceId) throw new Error("No subscription plan is configured yet.");

    const customerId = await ensureCustomer({
      companyId,
      companyName: c.name ?? "",
      email: c.contact_email ?? (context.claims as any)?.email ?? null,
      existingCustomerId: c.stripe_customer_id ?? null,
    });

    const session = await createSubscriptionCheckout({
      customerId,
      priceId,
      companyId,
      couponId: c.stripe_coupon_id ?? null,
      successUrl: `${data.origin}/settings/company?billing=success`,
      cancelUrl: `${data.origin}/settings/company?billing=cancelled`,
    });

    return { url: session.url };
  });

/** Open the Stripe Billing Portal (card, invoices, cancel). Owners only. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getCallerCompanyId } = await import("@/lib/permissions.server");
    const companyId = await getCallerCompanyId(context.supabase, context.userId);
    if (!companyId) throw new Error("No workspace found");

    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("company_id", companyId)
      .eq("active", true)
      .maybeSingle();
    if ((role as any)?.role !== "owner") throw new Error("Only the account owner can manage billing.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("stripe_customer_id")
      .eq("id", companyId)
      .maybeSingle();
    const customerId = (company as any)?.stripe_customer_id as string | null;
    if (!customerId) throw new Error("No billing account yet — add a payment method first.");

    const { createPortalSession } = await import("@/lib/platform-stripe.server");
    const session = await createPortalSession(customerId, `${data.origin}/settings/company`);
    return { url: session.url };
  });
