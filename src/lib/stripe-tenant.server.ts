// Server-only: per-tenant Stripe credentials (encrypt/decrypt) and Stripe REST calls.
// Never import from client-reachable module scope.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function aesKey(): Promise<CryptoKey> {
  const secret = process.env["STRIPE_KEY_ENCRYPTION_SECRET"];
  if (!secret) throw new Error("Encryption key is not configured.");
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): ArrayBuffer {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return buf;
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(payload: string): Promise<string> {
  const [ivPart, ctPart] = payload.split(".");
  if (!ivPart || !ctPart) throw new Error("Stored credential is malformed.");
  const key = await aesKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivPart) },
    key,
    unb64(ctPart),
  );
  return dec.decode(pt);
}

export type TenantStripe = {
  secretKey: string;
  webhookSecret: string | null;
  mode: string;
  last4: string;
};

/** Load and decrypt a company's Stripe credentials. Returns null when not configured. */
export async function getTenantStripe(companyId: string): Promise<TenantStripe | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("company_stripe_credentials" as never)
    .select("secret_key_encrypted, webhook_secret_encrypted, mode, secret_key_last4")
    .eq("company_id", companyId)
    .maybeSingle();
  const row = data as any;
  if (!row?.secret_key_encrypted) return null;
  return {
    secretKey: await decryptSecret(row.secret_key_encrypted),
    webhookSecret: row.webhook_secret_encrypted ? await decryptSecret(row.webhook_secret_encrypted) : null,
    mode: row.mode ?? "test",
    last4: row.secret_key_last4 ?? "",
  };
}

/** Minimal Stripe REST call (no SDK — edge-runtime safe). */
export async function stripeRequest<T = any>(
  secretKey: string,
  path: string,
  init?: { method?: string; form?: Record<string, string> },
): Promise<T> {
  const method = init?.method ?? "GET";
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Stripe request failed (${res.status})`);
  }
  return json as T;
}

/** Verify a secret key works by calling Stripe. Returns the account id. */
export async function verifySecretKey(secretKey: string): Promise<{ accountId: string; livemode: boolean }> {
  const acct = await stripeRequest<any>(secretKey, "/account");
  return { accountId: acct.id as string, livemode: !secretKey.includes("_test_") };
}

/** Zero-decimal currencies take integer amounts as-is. */
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

export function toStripeAmount(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

/** Create a Checkout Session for one payment row. Card + SEPA where supported. */
export async function createCheckoutSession(opts: {
  secretKey: string;
  currency: string;
  amount: number;
  label: string;
  paymentId: string;
  companyId: string;
  dealId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
}): Promise<{ id: string; url: string; expires_at?: number }> {
  const form: Record<string, string> = {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": opts.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(toStripeAmount(opts.amount, opts.currency)),
    "line_items[0][price_data][product_data][name]": opts.label,
    "payment_method_types[0]": "card",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "metadata[payment_id]": opts.paymentId,
    "metadata[company_id]": opts.companyId,
    "metadata[deal_id]": opts.dealId,
    "payment_intent_data[metadata][payment_id]": opts.paymentId,
    "payment_intent_data[metadata][company_id]": opts.companyId,
  };
  // SEPA debit is EUR-only.
  if (opts.currency.toUpperCase() === "EUR") form["payment_method_types[1]"] = "sepa_debit";
  if (opts.customerEmail) form["customer_email"] = opts.customerEmail;

  try {
    return await stripeRequest(opts.secretKey, "/checkout/sessions", { method: "POST", form });
  } catch (err: any) {
    // Account may not have SEPA enabled — retry with card only.
    if (form["payment_method_types[1]"]) {
      delete form["payment_method_types[1]"];
      return await stripeRequest(opts.secretKey, "/checkout/sessions", { method: "POST", form });
    }
    throw err;
  }
}

/** Verify a Stripe webhook signature (t=…,v1=… scheme) over the raw body. */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  webhookSecret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k?.trim(), rest.join("=")];
    }),
  ) as Record<string, string>;
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${rawBody}`)));
  const expected = Array.from(mac)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
