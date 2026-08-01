import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Rebuild the item snapshot for a single deal. */
export const snapshotDealItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ dealId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: deal, error } = await context.supabase
      .from("deals")
      .select("id")
      .eq("id", data.dealId)
      .maybeSingle();
    if (error || !deal) throw new Error("Deal not found");
    const { snapshotDealItemsAdmin } = await import("@/lib/deal-items.server");
    return await snapshotDealItemsAdmin(data.dealId);
  });

/** Rebuild snapshots for every won deal in the caller's company. */
export const backfillDealItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("company_id, role")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    if (!role?.company_id) throw new Error("No company");
    const { backfillCompanyDealItemsAdmin } = await import("@/lib/deal-items.server");
    return await backfillCompanyDealItemsAdmin(role.company_id as string);
  });
