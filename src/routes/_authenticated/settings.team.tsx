import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/components/settings-shared";
import { NON_OWNER_ROLES, useCompanyRole } from "@/lib/cost-visibility";
import { PermissionMatrixCard } from "@/components/permission-matrix";

export const Route = createFileRoute("/_authenticated/settings/team")({
  component: TeamSettings,
});

function TeamSettings() {
  const { company, loading } = useCompanySettings();
  const [members, setMembers] = useState<any[] | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .eq("company_id", company.id);
      setMembers(data ?? []);
    })();
  }, [company?.id]);

  if (loading || !company) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">

    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Team & users</CardTitle>
            <p className="text-sm text-muted-foreground">People with access to this company.</p>
          </div>
          <Button size="sm" variant="outline" disabled>
            Invite (soon)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {members === null ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : members.length === 0 ? (
          <div className="text-sm text-muted-foreground">No team members found.</div>
        ) : (
          <div className="divide-y rounded-md border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate font-mono text-xs text-muted-foreground">{m.user_id}</span>
                <Badge variant="secondary" className="capitalize">{m.role}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <PermissionMatrixCard />

    <CostVisibilityCard companyId={company.id} initial={company.cost_visible_roles ?? []} />
    </div>
  );
}

function CostVisibilityCard({ companyId, initial }: { companyId: string; initial: string[] }) {
  const { isOwner, loading } = useCompanyRole();
  const [roles, setRoles] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);

  function toggle(role: string) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ cost_visible_roles: roles } as any)
      .eq("id", companyId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cost visibility saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost visibility</CardTitle>
        <p className="text-sm text-muted-foreground">
          Internal costs and margins are never shown to clients. Choose which roles can see them.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">Owners always see costs.</div>
        <div className="space-y-2">
          {NON_OWNER_ROLES.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={roles.includes(r.value)}
                disabled={!isOwner || loading}
                onCheckedChange={() => toggle(r.value)}
              />
              {r.label}
            </label>
          ))}
        </div>
        {isOwner ? (
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Only the owner can change this setting.</p>
        )}
      </CardContent>
    </Card>
  );
}

