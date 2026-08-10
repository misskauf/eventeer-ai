import { supabase } from "@/integrations/supabase/client";

/** Warning shown before a permanent delete — keep wording in sync everywhere. */
export const DELETE_DEAL_WARNING =
  "This permanently deletes the lead and its proposals, contract, brief, invoices, and history — it cannot be undone.";

async function logActivity(dealId: string, companyId: string | null, kind: string) {
  const { data: userData } = await supabase.auth.getUser();
  let cid = companyId;
  if (!cid && userData.user) {
    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();
    cid = role?.company_id ?? null;
  }
  if (!cid) return;
  await supabase.from("deal_activities").insert({
    deal_id: dealId,
    company_id: cid,
    actor_id: userData.user?.id ?? null,
    kind,
    meta: {},
  });
}

/** Soft-archive a deal: hides it from the pipeline, keeps every record. */
export async function archiveDeal(dealId: string, companyId?: string | null) {
  const { error } = await supabase
    .from("deals")
    .update({ archived_at: new Date().toISOString() } as never)
    .eq("id", dealId);
  if (error) throw new Error(error.message);
  await logActivity(dealId, companyId ?? null, "deal_archived");
}

/** Restore an archived deal back into the pipeline. */
export async function restoreDeal(dealId: string, companyId?: string | null) {
  const { error } = await supabase
    .from("deals")
    .update({ archived_at: null } as never)
    .eq("id", dealId);
  if (error) throw new Error(error.message);
  await logActivity(dealId, companyId ?? null, "deal_restored");
}

/**
 * Permanently delete a deal. Proposals, selections, contracts, briefs,
 * invoices, items, tokens, notifications and activities cascade in the DB.
 */
export async function deleteDeal(dealId: string) {
  const { error } = await supabase.from("deals").delete().eq("id", dealId);
  if (error) throw new Error(error.message);
}
