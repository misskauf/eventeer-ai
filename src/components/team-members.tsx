import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  inviteMember,
  listTeam,
  removeMember,
  revokeInvite,
  setMemberActive,
  setMemberRole,
  transferOwnership,
} from "@/lib/team.functions";

const INVITE_ROLES = [
  { value: "sales_manager", label: "Sales manager" },
  { value: "event_manager", label: "Event manager" },
  { value: "accounting", label: "Accounting" },
];
const ALL_ROLES = [{ value: "owner", label: "Owner" }, ...INVITE_ROLES];

type TeamData = Awaited<ReturnType<typeof listTeam>>;

export function TeamMembersCard() {
  const load = useServerFn(listTeam);
  const invite = useServerFn(inviteMember);
  const revoke = useServerFn(revokeInvite);
  const changeRole = useServerFn(setMemberRole);
  const toggleActive = useServerFn(setMemberActive);
  const kick = useServerFn(removeMember);
  const transfer = useServerFn(transferOwnership);

  const [data, setData] = useState<TeamData | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState("sales_manager");

  async function refresh() {
    try {
      setData(await load({ data: undefined as never }));
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load team");
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const { canManage, callerIsOwner, members, invites } = data;
  const activeOwners = members.filter((m) => m.role === "owner" && m.active).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Team & users</CardTitle>
            <p className="text-sm text-muted-foreground">People with access to this company.</p>
          </div>
          {canManage && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">Invite member</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite a team member</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const email = String(new FormData(e.currentTarget).get("email") ?? "");
                    await run(
                      () => invite({ data: { email, role: inviteRole as never } }),
                      "Invitation sent",
                    );
                    setInviteOpen(false);
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input id="invite-email" name="email" type="email" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INVITE_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" disabled={busy}>Send invitation</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="divide-y rounded-md border">
          {members.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No team members found.
            </div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.email ?? m.user_id}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.active ? "Active" : "Deactivated"}
                    {m.isSelf ? " · you" : ""}
                    {m.role === "owner" && m.active && activeOwners <= 1
                      ? " · last owner (transfer ownership first)"
                      : ""}
                  </div>
                </div>
                {canManage ? (
                  <Select
                    value={m.role}
                    disabled={busy || (m.role === "owner" && m.active && activeOwners <= 1)}
                    onValueChange={(v) =>
                      run(
                        () => changeRole({ data: { member_id: m.id, role: v as never } }),
                        "Role updated",
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((r) => (
                        <SelectItem
                          key={r.value}
                          value={r.value}
                          disabled={r.value === "owner" && !callerIsOwner}
                        >
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    {m.role.replace(/_/g, " ")}
                  </Badge>
                )}
                {canManage && !m.isSelf && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || (m.role === "owner" && m.active && activeOwners <= 1)}
                      onClick={() =>
                        run(
                          () => toggleActive({ data: { member_id: m.id, active: !m.active } }),
                          m.active ? "Member deactivated" : "Member reactivated",
                        )
                      }
                    >
                      {m.active ? "Deactivate" : "Reactivate"}
                    </Button>
                    {callerIsOwner && m.role !== "owner" && m.active && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(`Make ${m.email ?? "this member"} the owner? You will step down to sales manager.`)) return;
                          run(
                            () =>
                              transfer({
                                data: { member_id: m.id, step_down_role: "sales_manager" },
                              }),
                            "Ownership transferred",
                          );
                        }}
                      >
                        Make owner
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || (m.role === "owner" && m.active && activeOwners <= 1)}
                      onClick={() => {
                        if (!confirm("Remove this member from the company?")) return;
                        run(() => kick({ data: { member_id: m.id } }), "Member removed");
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {invites.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">Pending invitations</div>
            <div className="divide-y rounded-md border">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1 truncate">{i.email}</div>
                  <Badge variant="secondary" className="capitalize">
                    {String(i.role).replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    expires {new Date(i.expires_at).toLocaleDateString()}
                  </span>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || (m.role === "owner" && m.active && activeOwners <= 1)}
                      onClick={() => run(() => revoke({ data: { invite_id: i.id } }), "Invitation revoked")}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
