import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PlatformCompanyTable } from "@/components/platform-company-table";
import { getPlatformOverview } from "@/lib/platform.functions";
import { usePlatformAdmin } from "@/lib/use-platform-admin";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminConsole,
  head: () => ({
    meta: [
      { title: "Platform console — EventFlow" },
      { name: "description", content: "Manage company accounts, trials and subscriptions." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminConsole() {
  const { isPlatformAdmin, loading } = usePlatformAdmin();
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getPlatformOverview);

  useEffect(() => {
    if (!loading && !isPlatformAdmin) void navigate({ to: "/deals", replace: true });
  }, [loading, isPlatformAdmin, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    enabled: isPlatformAdmin,
  });

  return (
    <AppShell>
      <PageHeader
        title="Platform console"
        description="All company accounts, trials and subscriptions."
      />
      {loading || !isPlatformAdmin ? (
        <p className="text-sm text-muted-foreground">Checking access…</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading accounts…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : (
        <PlatformCompanyTable companies={data?.companies ?? []} />
      )}
    </AppShell>
  );
}
