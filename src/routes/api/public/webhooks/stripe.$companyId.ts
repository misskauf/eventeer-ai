// Stripe webhook, one endpoint per venue: /api/public/webhooks/stripe/<companyId>.
// The signature is verified with that venue's own signing secret before anything is written.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/stripe/$companyId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const companyId = params.companyId;
        if (!/^[0-9a-f-]{36}$/i.test(companyId)) {
          return new Response("Bad request", { status: 400 });
        }

        const rawBody = await request.text();

        const { getTenantStripe, verifyStripeSignature } = await import("@/lib/stripe-tenant.server");
        const creds = await getTenantStripe(companyId);
        if (!creds?.webhookSecret) {
          return new Response("Not configured", { status: 404 });
        }

        const ok = await verifyStripeSignature(
          rawBody,
          request.headers.get("stripe-signature"),
          creds.webhookSecret,
        );
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const type = event?.type as string;
        const handled = [
          "checkout.session.completed",
          "checkout.session.async_payment_succeeded",
          "payment_intent.succeeded",
        ];
        if (!handled.includes(type)) return new Response("ignored");

        const obj = event?.data?.object ?? {};
        const paymentId = obj?.metadata?.payment_id as string | undefined;
        const metaCompany = obj?.metadata?.company_id as string | undefined;
        if (!paymentId || metaCompany !== companyId) return new Response("ignored");

        // A card checkout is only complete once payment_status says so; SEPA
        // arrives later via the async / payment_intent events.
        if (type === "checkout.session.completed" && obj.payment_status !== "paid") {
          return new Response("pending");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("payments" as never)
          .select("id, company_id, status")
          .eq("id", paymentId)
          .maybeSingle();
        if (!row || (row as any).company_id !== companyId) return new Response("ignored");

        const { applyPaymentPaid } = await import("@/lib/payments.server");
        await applyPaymentPaid({
          paymentId,
          method: "stripe",
          markedBy: null,
          stripeSessionId: type.startsWith("checkout.session") ? (obj.id as string) : null,
          stripePaymentIntent:
            type === "payment_intent.succeeded" ? (obj.id as string) : (obj.payment_intent as string) ?? null,
        });

        return new Response("ok");
      },
    },
  },
});
