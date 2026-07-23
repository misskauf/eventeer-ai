import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_deal",
  title: "Get deal",
  description:
    "Fetch a single deal with its activities and contracts (scoped to the signed-in user's company).",
  inputSchema: {
    deal_id: z.string().uuid().describe("UUID of the deal."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ deal_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const client = sb(ctx);
    const [deal, activities, contracts] = await Promise.all([
      client.from("deals").select("*").eq("id", deal_id).maybeSingle(),
      client
        .from("deal_activities")
        .select("*")
        .eq("deal_id", deal_id)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("contracts")
        .select("id, template_name, status, sent_at, signed_at, signed_by_name, updated_at")
        .eq("deal_id", deal_id)
        .order("updated_at", { ascending: false }),
    ]);
    if (deal.error) return { content: [{ type: "text", text: deal.error.message }], isError: true };
    if (!deal.data) return { content: [{ type: "text", text: "Deal not found" }], isError: true };
    const payload = {
      deal: deal.data,
      activities: activities.data ?? [],
      contracts: contracts.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
