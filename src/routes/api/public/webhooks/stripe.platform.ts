// Platform subscription webhook: /api/public/webhooks/stripe/platform
// Signature is verified with PLATFORM_STRIPE_WEBHOOK_SECRET before anything is written.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/stripe/platform")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        const { platformWebhookSecret } = await import("@/lib/platform-stripe.server");
        const secret = platformWebhookSecret();
        if (!secret) return new Response("Not configured", { status: 404 });

        const { verifyStripeSignature } = await import("@/lib/stripe-tenant.server");
        const ok = await verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret);
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const type = event?.type as string;
        const obj = event?.data?.object ?? {};
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        async function companyIdFor(): Promise<string | null> {
          const fromMeta = obj?.metadata?.company_id as string | undefined;
          if (fromMeta) return fromMeta;
          const customer = (obj?.customer as string | undefined) ?? undefined;
          if (!customer) return null;
          const { data } = await supabaseAdmin
            .from("companies")
            .select("id")
            .eq("stripe_customer_id", customer)
            .maybeSingle();
          return (data as any)?.id ?? null;
        }

        const companyId = await companyIdFor();
        if (!companyId) return new Response("ignored");

        const iso = (unix?: number | null) =>
          unix ? new Date(unix * 1000).toISOString() : null;

        if (type === "checkout.session.completed" && obj.mode === "subscription") {
          const subId = obj.subscription as string | undefined;
          let periodEnd: string | null = null;
          let priceId: string | null = null;
          if (subId) {
            const { platformStripe } = await import("@/lib/platform-stripe.server");
            const sub = await platformStripe<any>(`/subscriptions/${subId}`);
            periodEnd = iso(sub?.current_period_end);
            priceId = sub?.items?.data?.[0]?.price?.id ?? null;
          }
          await supabaseAdmin
            .from("companies")
            .update({
              subscription_status: "active",
              stripe_subscription_id: subId ?? null,
              stripe_customer_id: (obj.customer as string) ?? null,
              current_period_end: periodEnd,
              ...(priceId ? { stripe_price_id: priceId } : {}),
            } as never)
            .eq("id", companyId);
          return new Response("ok");
        }

        if (type === "invoice.paid") {
          await supabaseAdmin
            .from("companies")
            .update({
              subscription_status: "active",
              current_period_end: iso(obj?.lines?.data?.[0]?.period?.end),
              ...(obj.subscription ? { stripe_subscription_id: obj.subscription as string } : {}),
            } as never)
            .eq("id", companyId);
          return new Response("ok");
        }

        if (type === "invoice.payment_failed") {
          await supabaseAdmin
            .from("companies")
            .update({ subscription_status: "past_due" } as never)
            .eq("id", companyId);
          return new Response("ok");
        }

        if (type === "customer.subscription.updated") {
          const status = obj?.status as string;
          const map: Record<string, string> = {
            active: "active",
            trialing: "active",
            past_due: "past_due",
            unpaid: "past_due",
            canceled: "expired",
            incomplete_expired: "expired",
          };
          await supabaseAdmin
            .from("companies")
            .update({
              subscription_status: map[status] ?? "past_due",
              current_period_end: iso(obj?.current_period_end),
              stripe_price_id: obj?.items?.data?.[0]?.price?.id ?? null,
            } as never)
            .eq("id", companyId);
          return new Response("ok");
        }

        if (type === "customer.subscription.deleted") {
          await supabaseAdmin
            .from("companies")
            .update({ subscription_status: "expired", stripe_subscription_id: null } as never)
            .eq("id", companyId);
          return new Response("ok");
        }

        return new Response("ignored");
      },
    },
  },
});
