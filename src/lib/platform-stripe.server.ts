// Server-only: the PLATFORM Stripe account (venues paying us).
// Completely separate from src/lib/stripe-tenant.server.ts (venues charging their clients).

function platformKey(): string {
  const key = process.env["PLATFORM_STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Subscription billing is not configured yet.");
  return key;
}

export function defaultPriceId(): string | null {
  return process.env["PLATFORM_STRIPE_DEFAULT_PRICE_ID"] ?? null;
}

export function platformWebhookSecret(): string | null {
  return process.env["PLATFORM_STRIPE_WEBHOOK_SECRET"] ?? null;
}

/** Minimal Stripe REST call against the platform account (no SDK — edge-safe). */
export async function platformStripe<T = any>(
  path: string,
  init?: { method?: string; form?: Record<string, string> },
): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${platformKey()}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe request failed (${res.status})`);
  return json as T;
}

/** Get or create the Stripe Customer for a company and persist its id. */
export async function ensureCustomer(opts: {
  companyId: string;
  companyName: string;
  email: string | null;
  existingCustomerId: string | null;
}): Promise<string> {
  if (opts.existingCustomerId) return opts.existingCustomerId;

  const customer = await platformStripe<{ id: string }>("/customers", {
    method: "POST",
    form: {
      name: opts.companyName || "Venue",
      ...(opts.email ? { email: opts.email } : {}),
      "metadata[company_id]": opts.companyId,
    },
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("companies")
    .update({ stripe_customer_id: customer.id } as never)
    .eq("id", opts.companyId);

  return customer.id;
}

/** Hosted Checkout in subscription mode, with Stripe Tax and promo codes enabled. */
export async function createSubscriptionCheckout(opts: {
  customerId: string;
  priceId: string;
  companyId: string;
  couponId: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const form: Record<string, string> = {
    mode: "subscription",
    customer: opts.customerId,
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": "1",
    "automatic_tax[enabled]": "true",
    "customer_update[address]": "auto",
    "customer_update[name]": "auto",
    "tax_id_collection[enabled]": "true",
    billing_address_collection: "required",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "metadata[company_id]": opts.companyId,
    "subscription_data[metadata][company_id]": opts.companyId,
  };
  if (opts.couponId) {
    // A coupon and promo-code entry are mutually exclusive in Checkout.
    form["discounts[0][coupon]"] = opts.couponId;
  } else {
    form["allow_promotion_codes"] = "true";
  }
  return platformStripe("/checkout/sessions", { method: "POST", form });
}

/** Billing Portal session — card updates, invoices, cancellation. */
export async function createPortalSession(customerId: string, returnUrl: string) {
  return platformStripe<{ id: string; url: string }>("/billing_portal/sessions", {
    method: "POST",
    form: { customer: customerId, return_url: returnUrl },
  });
}
