import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/lib/use-permissions";
import { MODULE_LABELS, type PermissionLevel, type PermissionModule } from "@/lib/permissions";

/**
 * Wraps a route: redirects (or shows a no-access card) when the signed-in
 * user's role lacks `level` on `module`. Owner always passes.
 */
export function RequirePermission({
  module,
  level = "view",
  redirectTo = "/deals",
  children,
}: {
  module: PermissionModule | PermissionModule[];
  level?: PermissionLevel;
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const { can, loading } = usePermissions();
  const navigate = useNavigate();
  const modules = Array.isArray(module) ? module : [module];
  const allowed = modules.some((m) => can(m, level));

  useEffect(() => {
    if (!loading && !allowed && redirectTo) {
      navigate({ to: redirectTo, replace: true });
    }
  }, [loading, allowed, redirectTo, navigate]);

  if (loading) {
    return (
      <AppShell>
        <div className="text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  if (!allowed) {
    return (
      <AppShell>
        <Card>
          <CardHeader>
            <CardTitle>No access</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your role doesn’t have access to {modules.map((m) => MODULE_LABELS[m]).join(" / ")}. Ask an
            administrator to update your permissions.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return <>{children}</>;
}
