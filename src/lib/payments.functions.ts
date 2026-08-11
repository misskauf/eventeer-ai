// Server functions for per-deal payment schedules (auth) + the public payment page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const draftSchema = z.object({
  label: z.string().min(1).max(120),
  amount: z.number().nonnegative(),
  due_date: z.string().nullable().optional(),
});

/** List the deal's payments; persists overdue status for unpaid past-due rows. */
export const listPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ dealId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: deal } = await context.supabase
      .from("deals")
      .select("id, company_id")
      .eq("id", data.dealId)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found");
    const { requirePermission } = await import("@/lib/permissions.server");
    await requirePermission(context.supabase, deal.company_id as string, "payments", "view");

    const { data: rows, error } = await context.supabase
      .from("payments" as never)
      .select("*")
      .eq("deal_id", data.dealId)
      .order("sort", { ascending: true });
    if (error) throw new Error(error.message);

    const today = new Date();
    const stale = ((rows as any[]) ?? []).filter(
      (r) =>
        r.status !== "paid" &&
        r.status !== "overdue" &&
        r.due_date &&
        new Date(`${r.due_date}T23:59:59`) < today,
    );
    if (stale.length > 0) {
      await context.supabase
        .from("payments" as never)
        .update({ status: "overdue" } as never)
        .in("id", stale.map((r) => r.id));
      for (const r of stale) r.status = "overdue";
    }

    return { payments: (rows as any[]) ?? [] };
  });

/** Replace the unpaid part of the schedule with the given rows. */
export const saveSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        dealId: z.string().uuid(),
        terms: z.enum(["full", "installments", "after_event"]),
        rows: z.array(draftSchema).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: deal } = await context.supabase
      .from("deals")
      .select("id, company_id")
      .eq("id", data.dealId)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found");
    const { requirePermission } = await import("@/lib/permissions.server");
    await requirePermission(context.supabase, deal.company_id as string, "payments", "edit");

    // Keep paid rows; wipe everything else and re-create.
    const { error: delErr } = await context.supabase
      .from("payments" as never)
      .delete()
      .eq("deal_id", data.dealId)
      .neq("status", "paid");
    if (delErr) throw new Error(delErr.message);

    const { data: kept } = await context.supabase
      .from("payments" as never)
      .select("id")
      .eq("deal_id", data.dealId);
    const offset = ((kept as any[]) ?? []).length;

    const insert = data.rows.map((r, i) => ({
      company_id: deal.company_id,
      deal_id: data.dealId,
      label: r.label,
      amount: r.amount,
      due_date: r.due_date || null,
      status: "pending",
      sort: offset + i,
    }));
    const { error } = await context.supabase.from("payments" as never).insert(insert as never);
    if (error) throw new Error(error.message);

    await context.supabase.from("deal_activities").insert({
      deal_id: data.dealId,
      company_id: deal.company_id,
      actor_id: context.userId,
      kind: "payment_schedule_saved",
      meta: { terms: data.terms, rows: data.rows.length },
    } as never);

    return { ok: true as const };
  });

/** Mark one payment paid; rolls the deal stage forward and notifies the venue. */
export const markPaymentPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        paymentId: z.string().uuid(),
        method: z.enum(["bank", "stripe", "other"]).default("bank"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: pay } = await context.supabase
      .from("payments" as never)
      .select("*")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!pay) throw new Error("Payment not found");
    const p = pay as any;
    const { requirePermission } = await import("@/lib/permissions.server");
    await requirePermission(context.supabase, p.company_id as string, "payments", "edit");

    const { applyPaymentPaid } = await import("@/lib/payments.server");
    const res = await applyPaymentPaid({
      paymentId: data.paymentId,
      method: data.method,
      markedBy: context.userId,
    });

    return { ok: true as const, stage: res.stage, allPaid: res.allPaid };
  });

/** Create (or reuse) the client-facing payment page link for a deal. */
export const getPaymentShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ dealId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: deal } = await context.supabase
      .from("deals")
      .select("id, company_id")
      .eq("id", data.dealId)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found");
    const { requirePermission } = await import("@/lib/permissions.server");
    await requirePermission(context.supabase, deal.company_id as string, "payments", "edit");

    const { data: existing } = await context.supabase
      .from("share_tokens")
      .select("token")
      .eq("deal_id", data.dealId)
      .eq("kind", "payments" as never)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let token = existing?.token as string | undefined;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      const { error } = await context.supabase.from("share_tokens").insert({
        token,
        company_id: deal.company_id,
        kind: "payments" as never,
        deal_id: data.dealId,
        created_by: context.userId,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { token, path: `/pay/${token}` };
  });

/** Email the client a payment-due / overdue reminder in the deal's language. */
export const sendPaymentReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ paymentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: pay } = await context.supabase
      .from("payments" as never)
      .select("*")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!pay) throw new Error("Payment not found");
    const p = pay as any;
    const { requirePermission } = await import("@/lib/permissions.server");
    await requirePermission(context.supabase, p.company_id as string, "payments", "edit");
    if (p.status === "paid") throw new Error("This payment is already paid.");

    const { data: deal } = await context.supabase
      .from("deals")
      .select("id, client_name, client_email, language, company_id")
      .eq("id", p.deal_id)
      .maybeSingle();
    if (!deal?.client_email) throw new Error("This deal has no client email on file.");

    const { data: company } = await context.supabase
      .from("companies")
      .select("name, currency, bank_account_name, bank_name, bank_iban, bank_bic, payment_reference_note")
      .eq("id", p.company_id)
      .maybeSingle();

    // Reuse / create the share link.
    let token: string | undefined;
    const { data: existing } = await context.supabase
      .from("share_tokens")
      .select("token")
      .eq("deal_id", p.deal_id)
      .eq("kind", "payments" as never)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    token = existing?.token as string | undefined;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      await context.supabase.from("share_tokens").insert({
        token,
        company_id: p.company_id,
        kind: "payments" as never,
        deal_id: p.deal_id,
        created_by: context.userId,
      } as never);
    }

    const appOrigin = process.env.APP_URL ?? "";
    const shareUrl = appOrigin ? `${appOrigin.replace(/\/$/, "")}/pay/${token}` : `/pay/${token}`;

    const { payCopy, effectiveStatus } = await import("@/lib/payments");
    const c = payCopy((deal as any).language);
    const overdue = effectiveStatus(p) === "overdue";
    const cur = (company as any)?.currency ?? "EUR";
    const first = (deal.client_name ?? "").split(" ")[0] || "";

    const bank = [
      (company as any)?.bank_account_name ? `${c.account_name}: ${(company as any).bank_account_name}` : "",
      (company as any)?.bank_name ? `${c.bank}: ${(company as any).bank_name}` : "",
      (company as any)?.bank_iban ? `IBAN: ${(company as any).bank_iban}` : "",
      (company as any)?.bank_bic ? `BIC: ${(company as any).bank_bic}` : "",
      (company as any)?.payment_reference_note ? `${c.reference}: ${(company as any).payment_reference_note}` : "",
    ].filter(Boolean);

    const body = [
      `${c.greeting} ${first},`,
      ``,
      overdue ? c.overdue_line : c.due_line,
      ``,
      `${p.label}: ${cur} ${Number(p.amount).toFixed(2)}${p.due_date ? ` — ${c.due} ${p.due_date}` : ""}`,
      ``,
      ...(bank.length ? [`${c.bank_title}:`, ...bank, ``] : []),
      `${c.view_here} ${shareUrl}`,
      ``,
      c.thanks,
    ].join("\n");

    const { sendClientEmailAndNotify } = await import("@/lib/notifications.server");
    await sendClientEmailAndNotify({
      companyId: p.company_id,
      dealId: p.deal_id,
      toEmail: deal.client_email,
      subject: overdue ? c.subject_overdue : c.subject_due,
      body,
      shareUrl,
      internalTitle: `Payment reminder sent to ${deal.client_name}`,
      internalBody: `${p.label} — ${cur} ${Number(p.amount).toFixed(2)}`,
      activityMeta: { payment_id: p.id, overdue },
    });

    if (p.status === "pending") {
      await context.supabase
        .from("payments" as never)
        .update({ status: "sent" } as never)
        .eq("id", p.id);
    }

    return { ok: true as const, shareUrl };
  });

/** Public: resolve a payment page token (no auth). */
export const resolvePaymentToken = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().min(8) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tok } = await supabaseAdmin
      .from("share_tokens")
      .select("token, kind, deal_id, company_id, expires_at")
      .eq("token", data.token)
      .eq("kind", "payments" as never)
      .maybeSingle();
    if (!tok || !tok.deal_id) return { ok: false as const, reason: "not_found" };
    if (tok.expires_at && new Date(tok.expires_at) < new Date())
      return { ok: false as const, reason: "expired" };

    const [{ data: deal }, { data: company }, { data: rows }] = await Promise.all([
      supabaseAdmin
        .from("deals")
        .select("id, client_name, event_date, language")
        .eq("id", tok.deal_id)
        .maybeSingle(),
      supabaseAdmin
        .from("companies")
        .select(
          "id, name, logo_url, primary_color, currency, bank_account_name, bank_name, bank_iban, bank_bic, payment_reference_note, invoice_notes, stripe_enabled",
        )
        .eq("id", tok.company_id)
        .maybeSingle(),
      supabaseAdmin
        .from("payments" as never)
        .select("id, label, amount, due_date, status, paid_at, sort")
        .eq("deal_id", tok.deal_id)
        .order("sort", { ascending: true }),
    ]);

    if (!deal || !company) return { ok: false as const, reason: "not_found" };
    return {
      ok: true as const,
      deal,
      company,
      payments: ((rows as any[]) ?? []),
    };
  });

/**
 * Public: create (or reuse) a Stripe Checkout Session for one pending payment,
 * using the venue's own Stripe secret key. The key never leaves the server.
 */
export const createPaymentCheckout = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(8),
        paymentId: z.string().uuid(),
        origin: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tok } = await supabaseAdmin
      .from("share_tokens")
      .select("token, kind, deal_id, company_id, expires_at")
      .eq("token", data.token)
      .eq("kind", "payments" as never)
      .maybeSingle();
    if (!tok?.deal_id) throw new Error("This payment link is not valid.");
    if (tok.expires_at && new Date(tok.expires_at) < new Date())
      throw new Error("This payment link has expired.");

    const { data: payRow } = await supabaseAdmin
      .from("payments" as never)
      .select("*")
      .eq("id", data.paymentId)
      .eq("deal_id", tok.deal_id)
      .maybeSingle();
    const p = payRow as any;
    if (!p) throw new Error("Payment not found.");
    if (p.status === "paid") throw new Error("This payment is already paid.");

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, currency, stripe_enabled")
      .eq("id", tok.company_id)
      .maybeSingle();
    if (!(company as any)?.stripe_enabled) throw new Error("Card payments are not enabled.");

    // Reuse an unexpired session link.
    if (p.stripe_checkout_url && p.stripe_url_expires_at && new Date(p.stripe_url_expires_at) > new Date()) {
      return { url: p.stripe_checkout_url as string };
    }

    const { getTenantStripe, createCheckoutSession } = await import("@/lib/stripe-tenant.server");
    const creds = await getTenantStripe(tok.company_id as string);
    if (!creds) throw new Error("Card payments are not configured.");

    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("id, client_email")
      .eq("id", tok.deal_id)
      .maybeSingle();

    const base = `${data.origin.replace(/\/$/, "")}/pay/${data.token}`;
    const session = await createCheckoutSession({
      secretKey: creds.secretKey,
      currency: ((company as any)?.currency as string) ?? "EUR",
      amount: Number(p.amount),
      label: p.label as string,
      paymentId: p.id as string,
      companyId: tok.company_id as string,
      dealId: tok.deal_id as string,
      successUrl: `${base}?paid=1`,
      cancelUrl: `${base}?canceled=1`,
      customerEmail: (deal as any)?.client_email ?? null,
    });

    await supabaseAdmin
      .from("payments" as never)
      .update({
        stripe_session_id: session.id,
        stripe_checkout_url: session.url,
        stripe_url_expires_at: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
        status: p.status === "pending" ? "sent" : p.status,
      } as never)
      .eq("id", p.id);

    return { url: session.url };
  });
