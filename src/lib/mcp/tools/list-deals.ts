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
  name: "list_deals",
  title: "List deals",
  description:
    "List deals for the signed-in user's company. Optionally filter by stage or search by client name/company/email.",
  inputSchema: {
    stage: z
      .enum([
        "new",
        "qualified",
        "proposal_sent",
        "client_approved",
        "contract_sent",
        "contract_signed",
        "won",
        "lost",
      ])
      .optional()
      .describe("Filter by deal stage."),
    search: z.string().optional().describe("Case-insensitive match on client name, company, or email."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ stage, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = sb(ctx)
      .from("deals")
      .select(
        "id, client_name, client_company, client_email, stage, approval_status, event_date, guest_count, estimated_value, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (stage) q = q.eq("stage", stage);
    if (search) {
      const s = `%${search}%`;
      q = q.or(`client_name.ilike.${s},client_company.ilike.${s},client_email.ilike.${s}`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { deals: data ?? [] },
    };
  },
});
