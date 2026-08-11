// Manage a venue's own Stripe credentials. Secret values are write-only:
// nothing here ever returns a secret or webhook key to the client.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSettingsAdmin(supabase: any, companyId: string) {
  const { requirePermission } = await import("@/lib/permissions.server");
  await requirePermission(supabase, companyId, "settings", "admin");
}

/** Masked status for the settings UI. Never returns key material. */
export const getStripeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSettingsAdmin(context.supabase, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("company_stripe_credentials" as never)
      .select("secret_key_last4, mode, webhook_secret_encrypted, updated_at")
      .eq("company_id", data.companyId)
      .maybeSingle();
    const r = row as any;
    return {
      configured: !!r,
      last4: (r?.secret_key_last4 as string) ?? null,
      mode: (r?.mode as string) ?? null,
      hasWebhookSecret: !!r?.webhook_secret_encrypted,
      updatedAt: (r?.updated_at as string) ?? null,
    };
  });

/** Save/replace the secret key (validated against Stripe) and optional webhook secret. */
export const saveStripeCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        companyId: z.string().uuid(),
        secretKey: z.string().trim().min(20).max(300).optional(),
        webhookSecret: z.string().trim().min(10).max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSettingsAdmin(context.supabase, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret, verifySecretKey } = await import("@/lib/stripe-tenant.server");

    const patch: Record<string, unknown> = { company_id: data.companyId };

    if (data.secretKey) {
      if (!/^(sk|rk)_(test|live)_/.test(data.secretKey)) {
        throw new Error("That doesn't look like a Stripe secret key (it should start with sk_…).");
      }
      await verifySecretKey(data.secretKey); // throws with Stripe's message when invalid
      patch["secret_key_encrypted"] = await encryptSecret(data.secretKey);
      patch["secret_key_last4"] = data.secretKey.slice(-4);
      patch["mode"] = data.secretKey.includes("_live_") ? "live" : "test";
    }
    if (data.webhookSecret) {
      patch["webhook_secret_encrypted"] = await encryptSecret(data.webhookSecret);
    }

    const { data: existing } = await supabaseAdmin
      .from("company_stripe_credentials" as never)
      .select("id")
      .eq("company_id", data.companyId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("company_stripe_credentials" as never)
        .update(patch as never)
        .eq("company_id", data.companyId);
      if (error) throw new Error(error.message);
    } else {
      if (!patch["secret_key_encrypted"]) throw new Error("Add your Stripe secret key first.");
      const { error } = await supabaseAdmin
        .from("company_stripe_credentials" as never)
        .insert(patch as never);
      if (error) throw new Error(error.message);
    }

    return { ok: true as const };
  });

/** Store the publishable key and the on/off switch on the company record. */
export const saveStripeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        companyId: z.string().uuid(),
        publishableKey: z.string().trim().max(300).nullable(),
        enabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSettingsAdmin(context.supabase, data.companyId);

    if (data.publishableKey && !/^pk_(test|live)_/.test(data.publishableKey)) {
      throw new Error("The publishable key should start with pk_test_ or pk_live_.");
    }

    if (data.enabled) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: creds } = await supabaseAdmin
        .from("company_stripe_credentials" as never)
        .select("secret_key_encrypted")
        .eq("company_id", data.companyId)
        .maybeSingle();
      if (!(creds as any)?.secret_key_encrypted) {
        throw new Error("Add and save your Stripe secret key before enabling card payments.");
      }
    }

    const { error } = await context.supabase
      .from("companies")
      .update({
        stripe_enabled: data.enabled,
        stripe_publishable_key: data.publishableKey || null,
      } as never)
      .eq("id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Remove stored credentials and switch card payments off. */
export const removeStripeCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSettingsAdmin(context.supabase, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("company_stripe_credentials" as never)
      .delete()
      .eq("company_id", data.companyId);
    await context.supabase
      .from("companies")
      .update({ stripe_enabled: false } as never)
      .eq("id", data.companyId);
    return { ok: true as const };
  });
