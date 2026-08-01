// Server functions for public (unauthenticated) client proposal + shared dashboard tokens.
// Uses admin client server-side (loaded inside handlers) since these are magic-link routes.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const resolveProposalToken = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().min(8) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tok } = await supabaseAdmin
      .from("share_tokens")
      .select("token, kind, deal_id, proposal_id, company_id, expires_at")
      .eq("token", data.token)
      .in("kind", ["client_proposal", "preview"] as any)
      .maybeSingle();

    if (!tok || !tok.proposal_id) return { ok: false as const, reason: "not_found" };
    if (tok.expires_at && new Date(tok.expires_at) < new Date())
      return { ok: false as const, reason: "expired" };

    const [{ data: proposal }, { data: company }, { data: deal }] = await Promise.all([
      supabaseAdmin.from("proposals").select("*").eq("id", tok.proposal_id).maybeSingle(),
      supabaseAdmin
        .from("companies")
        .select("id, name, logo_url, primary_color, currency")
        .eq("id", tok.company_id)
        .maybeSingle(),
      supabaseAdmin.from("deals").select("*").eq("id", tok.deal_id!).maybeSingle(),
    ]);

    if (!proposal || !company || !deal) return { ok: false as const, reason: "not_found" };

    const offerCfg: any = (proposal as any).offer ?? {};
    const groups: Array<{ id: string; category: string; item_ids: string[]; default_id?: string }> =
      offerCfg.alternative_groups ?? [];
    const spaceIds = Array.from(new Set<string>([
      ...(offerCfg.space_ids ?? []),
      ...groups.filter((g) => g.category === "space").flatMap((g) => g.item_ids),
    ]));
    const pkgIds = Array.from(new Set<string>([
      ...(offerCfg.package_ids ?? []),
      ...groups.filter((g) => g.category === "food" || g.category === "beverage").flatMap((g) => g.item_ids),
    ]));
    const extraIds = Array.from(new Set<string>([
      ...(offerCfg.extra_ids ?? []),
      ...groups.filter((g) => g.category === "extra").flatMap((g) => g.item_ids),
    ]));

    const staffIds = Array.from(new Set<string>([
      ...(offerCfg.staff_ids ?? []),
      ...groups.filter((g) => g.category === "staff").flatMap((g) => g.item_ids),
    ]));

    const [spacesRes, packagesRes, extrasRes, staffRes, feeCfgRes, seasonRes] = await Promise.all([
      spaceIds.length
        ? supabaseAdmin.from("spaces").select("id, name, name_de, base_rental_fee, min_rental_fee, basis, tax_rate_pct, long_description, long_description_de, weekday_pricing").in("id", spaceIds)
        : Promise.resolve({ data: [] } as any),
      pkgIds.length
        ? supabaseAdmin.from("fb_packages").select("id, name, name_de, price_per_person, kind, basis, tax_rate_pct, long_description, long_description_de, included_hours, overage_price_per_person_per_hour, selection_mode, selection_groups, selection_total_max, details_url").in("id", pkgIds)
        : Promise.resolve({ data: [] } as any),
      extraIds.length
        ? supabaseAdmin.from("extras").select("id, name, name_de, pricing_type, price, basis, tax_rate_pct, long_description, long_description_de").in("id", extraIds)
        : Promise.resolve({ data: [] } as any),
      staffIds.length
        ? supabaseAdmin.from("staff_roles").select("id, name, name_de, pricing_type, price, basis, tax_rate_pct, long_description, long_description_de").in("id", staffIds)
        : Promise.resolve({ data: [] } as any),
      supabaseAdmin.from("fee_config").select("*").eq("company_id", tok.company_id).maybeSingle(),
      offerCfg.season_id && offerCfg.season_id !== "none"
        ? supabaseAdmin.from("pricing_seasons").select("multiplier").eq("id", offerCfg.season_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    return {
      ok: true as const,
      proposal,
      company,
      deal,
      preview: (tok.kind as string) === "preview",
      spaces: spacesRes.data ?? [],
      packages: packagesRes.data ?? [],
      extras: extrasRes.data ?? [],
      staff: staffRes.data ?? [],
      feeConfig: feeCfgRes.data ?? {},
      seasonMultiplier: (seasonRes as any).data?.multiplier ?? 1,
    };
  });


export const submitClientSelection = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(8),
        action: z.enum(["confirmed", "changes_requested", "declined"]).default("confirmed"),
        note: z.string().optional(),
        selection: z.record(z.string(), z.any()),
        computed_total: z.number().min(0),
        client_response: z
          .object({
            overall_message: z.string().optional(),
            item_notes: z.record(z.string(), z.string()).optional(),
            selected_alternatives: z.record(z.string(), z.string()).optional(),
            menu_choices: z.record(z.string(), z.record(z.string(), z.array(z.string()))).optional(),
          })
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tok } = await supabaseAdmin
      .from("share_tokens")
      .select("token, kind, deal_id, proposal_id, company_id, expires_at")
      .eq("token", data.token)
      .in("kind", ["client_proposal", "preview"] as any)
      .maybeSingle();
    if (!tok || !tok.proposal_id || !tok.deal_id) throw new Error("Invalid link");
    if (tok.expires_at && new Date(tok.expires_at) < new Date()) throw new Error("Link expired");

    // Preview tokens: no-op, do not touch deal state or record a selection.
    if ((tok.kind as string) === "preview") {
      return { ok: true as const, preview: true };
    }

    const action = data.action;

    await supabaseAdmin.from("proposal_selections").insert({
      proposal_id: tok.proposal_id,
      company_id: tok.company_id,
      selection: data.selection,
      computed_total: data.computed_total,
      menu_choices: data.client_response?.menu_choices ?? {},
      client_action: action,
    } as any);

    // Merge client_response into proposal.constraints so the manager sees it.
    const { data: prop } = await supabaseAdmin
      .from("proposals")
      .select("constraints")
      .eq("id", tok.proposal_id)
      .maybeSingle();
    const currentConstraints = (prop?.constraints as Record<string, any> | null) ?? {};
    const proposalStatus =
      action === "confirmed" ? "accepted" : action === "declined" ? "declined" : "changes_requested";
    await supabaseAdmin
      .from("proposals")
      .update({
        status: proposalStatus,
        constraints: {
          ...currentConstraints,
          client_response: {
            ...(data.client_response ?? {}),
            action,
            note: data.note ?? null,
            submitted_at: new Date().toISOString(),
            computed_total: data.computed_total,
          },
        },
      } as any)
      .eq("id", tok.proposal_id);

    // Only advance the stage forward — don't downgrade a signed / paid deal.
    const { data: currentDeal } = await supabaseAdmin
      .from("deals")
      .select("stage")
      .eq("id", tok.deal_id)
      .maybeSingle();
    const preApprovalStages = new Set([
      "new", "contacted", "meeting_scheduled", "proposal_sent", "changes_requested",
      "inquiry", "proposal_draft", "manager_review", "client_selected",
    ]);
    const terminalStages = new Set([
      "signed", "waiting_payment", "invoice_sent", "downpayment_received", "paid_in_full",
    ]);
    const cur = currentDeal?.stage as string | undefined;
    let nextStage: string | null = null;
    if (action === "confirmed" && (!cur || preApprovalStages.has(cur))) {
      nextStage = "client_approved";
    } else if (action === "changes_requested" && (!cur || preApprovalStages.has(cur) || cur === "client_approved")) {
      nextStage = "changes_requested";
    } else if (action === "declined" && (!cur || !terminalStages.has(cur))) {
      nextStage = "lost";
    }
    const updatePayload: { estimated_value: number; stage?: any } = { estimated_value: data.computed_total };
    if (nextStage) updatePayload.stage = nextStage;
    await supabaseAdmin.from("deals").update(updatePayload as any).eq("id", tok.deal_id);

    const { notifyDeal } = await import("@/lib/notifications.server");
    const noteExcerpt = data.note ? ` — "${data.note.slice(0, 200)}"` : "";
    const msgExcerpt = data.client_response?.overall_message
      ? ` — "${data.client_response.overall_message.slice(0, 200)}"`
      : "";
    if (action === "confirmed") {
      await notifyDeal({
        companyId: tok.company_id as string,
        dealId: tok.deal_id as string,
        kind: "client_confirmed",
        title: "Client confirmed their selection",
        body: `The client submitted their selection${msgExcerpt || "."}`,
        meta: { computed_total: data.computed_total },
      });
    } else if (action === "changes_requested") {
      await notifyDeal({
        companyId: tok.company_id as string,
        dealId: tok.deal_id as string,
        kind: "client_requested_changes",
        title: "Client requested changes",
        body: `The client asked for changes${noteExcerpt || msgExcerpt || "."}`,
        meta: { computed_total: data.computed_total, note: data.note ?? null },
      });
    } else {
      await notifyDeal({
        companyId: tok.company_id as string,
        dealId: tok.deal_id as string,
        kind: "client_declined",
        title: "Client declined the offer",
        body: `The client declined${noteExcerpt || msgExcerpt || "."}`,
        meta: { note: data.note ?? null },
      });
    }

    return { ok: true as const, action };
  });

export const resolveDashboardToken = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().min(8) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tok } = await supabaseAdmin
      .from("share_tokens")
      .select("token, kind, deal_id, company_id, expires_at")
      .eq("token", data.token)
      .eq("kind", "dashboard")
      .maybeSingle();
    if (!tok || !tok.deal_id) return { ok: false as const };
    if (tok.expires_at && new Date(tok.expires_at) < new Date()) return { ok: false as const };

    const [{ data: deal }, { data: company }, { data: activities }, { data: proposals }] =
      await Promise.all([
        supabaseAdmin.from("deals").select("*").eq("id", tok.deal_id).maybeSingle(),
        supabaseAdmin
          .from("companies")
          .select("id, name, logo_url, primary_color, currency")
          .eq("id", tok.company_id)
          .maybeSingle(),
        supabaseAdmin
          .from("deal_activities")
          .select("*")
          .eq("deal_id", tok.deal_id)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("proposals")
          .select("id, version, status, created_at, sent_at")
          .eq("deal_id", tok.deal_id)
          .order("version", { ascending: false }),
      ]);
    if (!deal || !company) return { ok: false as const };
    return { ok: true as const, deal, company, activities: activities ?? [], proposals: proposals ?? [] };
  });
