import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCompanySettings } from "@/components/settings-shared";
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

    </div>
  );
}
