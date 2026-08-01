import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const assignableRole = z.enum(["owner", "sales_manager", "event_manager", "accounting"]);
const inviteRole = z.enum(["sales_manager", "event_manager", "accounting"]);

const INVITE_TTL_DAYS = 14;

/** Resolve caller's company and require team-admin (owner always passes). */
async function requireTeamAdmin(supabase: any, userId: string) {
  const { getCallerCompanyId, requirePermission } = await import("@/lib/permissions.server");
  const companyId = await getCallerCompanyId(supabase, userId);
  if (!companyId) throw new Error("No company found for this user");
  await requirePermission(supabase, companyId, "team", "admin");
  return companyId;
}

async function isOwner(companyId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("active", true)
    .maybeSingle();
  return !!data;
}

/** Number of active owners left, used for the last-owner safeguards. */
async function activeOwnerCount(companyId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "owner")
    .eq("active", true);
  return count ?? 0;
}

async function guardLastOwner(companyId: string, memberRole: string, memberActive: boolean) {
  if (memberRole !== "owner" || !memberActive) return;
  if ((await activeOwnerCount(companyId)) <= 1) {
    throw new Error("This is the last owner — assign another owner first.");
  }
}

async function getMemberRow(companyId: string, memberId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id, user_id, role, active, status")
    .eq("id", memberId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) throw new Error("Member not found");
  return data;
}

/** Members (with emails) + pending invites. Requires team view. */
export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCallerCompanyId, requirePermission } = await import("@/lib/permissions.server");
    const companyId = await getCallerCompanyId(context.supabase, context.userId);
    if (!companyId) throw new Error("No company found for this user");
    const level = await requirePermission(context.supabase, companyId, "team", "view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, active, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const members = await Promise.all(
      (rows ?? []).map(async (r) => {
        let email: string | null = null;
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
          email = data.user?.email ?? null;
        } catch {
          email = null;
        }
        return { ...r, email, isSelf: r.user_id === context.userId };
      }),
    );

    const { data: invites } = await supabaseAdmin
      .from("company_invites")
      .select("id, email, role, expires_at, accepted_at, created_at")
      .eq("company_id", companyId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    return {
      companyId,
      canManage: level === "admin",
      callerIsOwner: await isOwner(companyId, context.userId),
      members,
      invites: invites ?? [],
    };
  });

/** Create an invite and email the accept link. */
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ email: z.string().trim().email().max(255), role: inviteRole })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const companyId = await requireTeamAdmin(context.supabase, context.userId);
    const { logPermissionAudit } = await import("@/lib/permissions.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    const expires_at = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString();

    // Replace any outstanding invite for the same address.
    await supabaseAdmin
      .from("company_invites")
      .delete()
      .eq("company_id", companyId)
      .eq("email", email)
      .is("accepted_at", null);

    const { error } = await supabaseAdmin.from("company_invites").insert({
      company_id: companyId,
      email,
      role: data.role,
      token,
      invited_by: context.userId,
      expires_at,
    });
    if (error) throw new Error(error.message);

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    const origin = new URL(getRequest().url).origin;
    const link = `${origin}/invite/${token}`;
    try {
      const { sendHtmlEmail } = await import("@/lib/notifications.server");
      await sendHtmlEmail({
        to: [email],
        subject: `You're invited to ${company?.name ?? "the team"}`,
        html: `
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">
            <p>You've been invited to join <strong>${company?.name ?? "a workspace"}</strong> as
            <strong>${data.role.replace(/_/g, " ")}</strong>.</p>
            <p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;border-radius:6px;text-decoration:none">Accept invitation</a></p>
            <p style="color:#64748b">Or open: ${link}<br/>This link expires in ${INVITE_TTL_DAYS} days.</p>
          </div>`,
      });
    } catch (err) {
      console.warn("[inviteMember] email failed", err);
    }

    await logPermissionAudit({
      companyId,
      actorId: context.userId,
      action: "member_invited",
      target: email,
      detail: { role: data.role },
    });
    return { ok: true, link };
  });

/** Cancel a pending invite. */
export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ invite_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const companyId = await requireTeamAdmin(context.supabase, context.userId);
    const { logPermissionAudit } = await import("@/lib/permissions.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("company_invites")
      .select("email")
      .eq("id", data.invite_id)
      .eq("company_id", companyId)
      .maybeSingle();
    await supabaseAdmin
      .from("company_invites")
      .delete()
      .eq("id", data.invite_id)
      .eq("company_id", companyId);
    await logPermissionAudit({
      companyId,
      actorId: context.userId,
      action: "invite_revoked",
      target: inv?.email ?? data.invite_id,
    });
    return { ok: true };
  });

/** Change a member's role. Only owners may grant/revoke the owner role. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ member_id: z.string().uuid(), role: assignableRole }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const companyId = await requireTeamAdmin(context.supabase, context.userId);
    const { logPermissionAudit } = await import("@/lib/permissions.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const member = await getMemberRow(companyId, data.member_id);

    const callerOwner = await isOwner(companyId, context.userId);
    if ((data.role === "owner" || member.role === "owner") && !callerOwner) {
      throw new Error("Only an owner can change owner roles");
    }
    if (member.role === "owner" && data.role !== "owner") {
      await guardLastOwner(companyId, member.role, member.active);
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.role })
      .eq("id", member.id);
    if (error) throw new Error(error.message);

    await logPermissionAudit({
      companyId,
      actorId: context.userId,
      action: "member_role_changed",
      target: member.user_id,
      detail: { from: member.role, to: data.role },
    });
    return { ok: true };
  });

/** Activate / deactivate a member (keeps history). */
export const setMemberActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ member_id: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const companyId = await requireTeamAdmin(context.supabase, context.userId);
    const { logPermissionAudit } = await import("@/lib/permissions.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const member = await getMemberRow(companyId, data.member_id);

    if (!data.active) {
      if (member.role === "owner" && !(await isOwner(companyId, context.userId))) {
        throw new Error("Only an owner can deactivate an owner");
      }
      await guardLastOwner(companyId, member.role, member.active);
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ active: data.active, status: data.active ? "active" : "disabled" })
      .eq("id", member.id);
    if (error) throw new Error(error.message);

    await logPermissionAudit({
      companyId,
      actorId: context.userId,
      action: data.active ? "member_reactivated" : "member_deactivated",
      target: member.user_id,
    });
    return { ok: true };
  });

/** Remove a member from the company entirely. */
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ member_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const companyId = await requireTeamAdmin(context.supabase, context.userId);
    const { logPermissionAudit } = await import("@/lib/permissions.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const member = await getMemberRow(companyId, data.member_id);

    if (member.role === "owner" && !(await isOwner(companyId, context.userId))) {
      throw new Error("Only an owner can remove an owner");
    }
    await guardLastOwner(companyId, member.role, member.active);

    const { error } = await supabaseAdmin.from("user_roles").delete().eq("id", member.id);
    if (error) throw new Error(error.message);

    await logPermissionAudit({
      companyId,
      actorId: context.userId,
      action: "member_removed",
      target: member.user_id,
      detail: { role: member.role },
    });
    return { ok: true };
  });

/** Transfer ownership: target becomes owner, caller steps down to the given role. */
export const transferOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        member_id: z.string().uuid(),
        step_down_role: inviteRole.default("sales_manager"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const companyId = await requireTeamAdmin(context.supabase, context.userId);
    if (!(await isOwner(companyId, context.userId))) {
      throw new Error("Only an owner can transfer ownership");
    }
    const { logPermissionAudit } = await import("@/lib/permissions.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const member = await getMemberRow(companyId, data.member_id);
    if (member.user_id === context.userId) throw new Error("Already the owner");
    if (!member.active) throw new Error("Reactivate this member before transferring ownership");

    const { error: upErr } = await supabaseAdmin
      .from("user_roles")
      .update({ role: "owner", active: true, status: "active" })
      .eq("id", member.id);
    if (upErr) throw new Error(upErr.message);

    const { error: downErr } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.step_down_role })
      .eq("company_id", companyId)
      .eq("user_id", context.userId);
    if (downErr) throw new Error(downErr.message);

    await logPermissionAudit({
      companyId,
      actorId: context.userId,
      action: "ownership_transferred",
      target: member.user_id,
      detail: { previous_owner: context.userId, step_down_role: data.step_down_role },
    });
    return { ok: true };
  });

/**
 * Accept invites for the signed-in user. Matches by token when provided,
 * otherwise by the account's email address (used right after sign-up/login).
 */
export const acceptInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ token: z.string().trim().max(200).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logPermissionAudit } = await import("@/lib/permissions.server");

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userRes.user?.email?.toLowerCase() ?? null;

    let query = supabaseAdmin
      .from("company_invites")
      .select("id, company_id, email, role, expires_at")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());
    query = data.token ? query.eq("token", data.token) : query.eq("email", email ?? "__none__");
    const { data: invites } = await query;

    if (!invites?.length) return { accepted: 0 };

    let accepted = 0;
    for (const inv of invites) {
      // A token link may only be redeemed by the address it was sent to.
      if (email && inv.email.toLowerCase() !== email) continue;

      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("company_id", inv.company_id)
        .eq("user_id", context.userId)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("user_roles")
          .update({ role: inv.role, active: true, status: "active" })
          .eq("id", existing.id);
      } else {
        const { error } = await supabaseAdmin.from("user_roles").insert({
          company_id: inv.company_id,
          user_id: context.userId,
          role: inv.role,
          active: true,
          status: "active",
        });
        if (error) {
          console.warn("[acceptInvites]", error.message);
          continue;
        }
      }

      await supabaseAdmin
        .from("company_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", inv.id);

      await logPermissionAudit({
        companyId: inv.company_id,
        actorId: context.userId,
        action: "invite_accepted",
        target: inv.email,
        detail: { role: inv.role },
      });
      accepted += 1;
    }
    return { accepted };
  });
