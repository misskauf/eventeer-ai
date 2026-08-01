// Server functions for optional invoicing (document generation only).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Set an invoice's status and move the deal stage / log activity accordingly. */
export const updateInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        invoice_id: z.string().uuid(),
        status: z.enum(["draft", "sent", "done"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase
      .from("invoices" as any)
      .select("id, deal_id, company_id, status, issued_at")
      .eq("id", data.invoice_id)
      .maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    {
      const { requirePermission } = await import("@/lib/permissions.server");
      await requirePermission(context.supabase, (inv as any).company_id as string, "invoices", "edit");
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "sent" && !(inv as any).issued_at) patch.issued_at = now;

    const { error } = await context.supabase
      .from("invoices" as any)
      .update(patch as any)
      .eq("id", data.invoice_id);
    if (error) throw new Error(error.message);

    if (data.status === "sent") {
      // Move deal stage to invoice_sent (only if it isn't already past this step).
      await context.supabase
        .from("deals")
        .update({ stage: "invoice_sent" } as any)
        .eq("id", (inv as any).deal_id)
        .in("stage", ["signed", "waiting_payment", "client_approved"]);

      await context.supabase.from("deal_activities").insert({
        deal_id: (inv as any).deal_id,
        company_id: (inv as any).company_id,
        actor_id: context.userId,
        kind: "invoice_sent",
        meta: { invoice_id: (inv as any).id },
      } as any);

      const { notifyDeal } = await import("@/lib/notifications.server");
      await notifyDeal({
        companyId: (inv as any).company_id as string,
        dealId: (inv as any).deal_id as string,
        kind: "invoice_sent",
        title: "Invoice marked as sent",
        body: "The venue marked the invoice for this deal as sent.",
        meta: { invoice_id: (inv as any).id },
      });
    } else if (data.status === "done") {
      await context.supabase.from("deal_activities").insert({
        deal_id: (inv as any).deal_id,
        company_id: (inv as any).company_id,
        actor_id: context.userId,
        kind: "invoice_done",
        meta: { invoice_id: (inv as any).id },
      } as any);
    }

    return { ok: true as const };
  });
