import { createFileRoute } from "@tanstack/react-router";
import { useCompanySettings } from "@/components/settings-shared";
import { PermissionMatrixCard } from "@/components/permission-matrix";
import { TeamMembersCard } from "@/components/team-members";

export const Route = createFileRoute("/_authenticated/settings/team")({
  component: TeamSettings,
});

function TeamSettings() {
  const { company, loading } = useCompanySettings();
  if (loading || !company) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <TeamMembersCard />
      <PermissionMatrixCard />
    </div>
  );
}
