// Server-only: the single source of truth for "a payment became paid".
// Used by the manual Mark-paid action and by the Stripe webhook so both paths
// behave identically (stage roll-up, activity log, venue notification).

export type MarkPaidResult = {
  alreadyPaid: boolean;
  allPaid: boolean;
  stage: string | null;
};

export async function applyPaymentPaid(input: {
  paymentId: string;
  method: "bank" | "stripe" | "other";
  markedBy?: string | null;
  stripeSessionId?: string | null;
  stripePaymentIntent?: string | null;
}): Promise<MarkPaidResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data } = await supabaseAdmin
    .from("payments" as never)
    .select("*")
    .eq("id", input.paymentId)
    .maybeSingle();
  const p = data as any;
  if (!p) throw new Error("Payment not found");

  // Idempotent: webhook retries must not double-notify.
  if (p.status === "paid") return { alreadyPaid: true, allPaid: false, stage: null };

  const patch: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
    method: input.method,
    marked_by: input.markedBy ?? null,
  };
  if (input.stripeSessionId) patch["stripe_session_id"] = input.stripeSessionId;
  if (input.stripePaymentIntent) patch["stripe_payment_intent"] = input.stripePaymentIntent;

  const { error } = await supabaseAdmin
    .from("payments" as never)
    .update(patch as never)
    .eq("id", input.paymentId);
  if (error) throw new Error(error.message);

  const { data: all } = await supabaseAdmin
    .from("payments" as never)
    .select("id, status")
    .eq("deal_id", p.deal_id);
  const rows = ((all as any[]) ?? []).map((r) =>
    r.id === input.paymentId ? { ...r, status: "paid" } : r,
  );
  const allPaid = rows.length > 0 && rows.every((r) => r.status === "paid");
  const nextStage = allPaid ? "paid_in_full" : "downpayment_received";
  const rollForwardFrom = allPaid
    ? [
        "signed",
        "waiting_payment",
        "invoice_sent",
        "downpayment_received",
        "payment_delayed",
        "client_approved",
      ]
    : ["signed", "waiting_payment", "invoice_sent", "payment_delayed", "client_approved"];

  await supabaseAdmin
    .from("deals")
    .update({ stage: nextStage } as never)
    .eq("id", p.deal_id)
    .in("stage", rollForwardFrom as never);

  await supabaseAdmin.from("deal_activities").insert({
    deal_id: p.deal_id,
    company_id: p.company_id,
    actor_id: input.markedBy ?? null,
    kind: "payment_marked_paid",
    meta: {
      payment_id: p.id,
      label: p.label,
      amount: p.amount,
      method: input.method,
    },
  } as never);

  const { notifyDeal } = await import("@/lib/notifications.server");
  await notifyDeal({
    companyId: p.company_id as string,
    dealId: p.deal_id as string,
    kind: "payment_paid",
    title: `Payment received: ${p.label}`,
    body:
      input.method === "stripe"
        ? `${p.label} of ${p.amount} was paid by card/SEPA via Stripe.`
        : `${p.label} of ${p.amount} was marked as paid.`,
    meta: { payment_id: p.id, method: input.method },
  });

  return { alreadyPaid: false, allPaid, stage: nextStage };
}
