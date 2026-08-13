import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Every company-scoped table included in a workspace export.
 * Excluded on purpose: company_stripe_credentials + share_tokens (secrets/tokens),
 * marketing_leads + platform_* (not customer data), deal_items_visible (view of deal_items).
 */
const COMPANY_TABLES = [
  "companies",
  "fee_config",
  "role_permissions",
  "user_roles",
  "company_invites",
  "deals",
  "deal_items",
  "deal_activities",
  "proposals",
  "proposal_selections",
  "spaces",
  "fb_packages",
  "extras",
  "staff_roles",
  "pricing_rules",
  "pricing_seasons",
  "contracts",
  "contract_templates",
  "invoices",
  "invoice_templates",
  "event_briefs",
  "event_brief_templates",
  "payments",
  "lead_forms",
  "goals",
  "dashboard_layouts",
  "notifications",
  "permission_audit",
] as const;

/** Sensitive columns stripped from exported rows. */
const REDACTED_COLUMNS: Record<string, string[]> = {
  companies: ["stripe_publishable_key"],
  contracts: ["signing_token", "signing_token_expires_at"],
  company_invites: ["token"],
  payments: ["stripe_session_id", "stripe_payment_intent", "stripe_checkout_url", "stripe_url_expires_at"],
};

function stripColumns(table: string, rows: any[]) {
  const drop = REDACTED_COLUMNS[table];
  if (!drop || !rows.length) return rows;
  return rows.map((r) => {
    const copy = { ...r };
    for (const key of drop) delete copy[key];
    return copy;
  });
}

/** Full workspace export as structured JSON. Owner only. */
export const exportCompanyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCallerCompanyId, logPermissionAudit } = await import("@/lib/permissions.server");
    const companyId = await getCallerCompanyId(context.supabase, context.userId);
    if (!companyId) throw new Error("No company found for this user");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: owner } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .eq("active", true)
      .maybeSingle();
    if (!owner) throw new Error("Not permitted: only workspace owners can export data");

    const tables: Record<string, any[]> = {};
    for (const table of COMPANY_TABLES) {
      const column = table === "companies" ? "id" : "company_id";
      const { data, error } = await supabaseAdmin.from(table as any).select("*").eq(column, companyId);
      if (error) throw new Error(`Export failed on ${table}: ${error.message}`);
      tables[table] = stripColumns(table, (data as any[]) ?? []);
    }

    const companyName = (tables.companies?.[0]?.name as string) ?? "workspace";
    const exportedAt = new Date().toISOString();

    await logPermissionAudit({
      companyId,
      actorId: context.userId,
      action: "data_exported",
      target: companyId,
      detail: {
        tables: COMPANY_TABLES.length,
        rows: Object.values(tables).reduce((sum, rows) => sum + rows.length, 0),
      },
    });

    return { companyId, companyName, exportedAt, tables };
  });
