import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RequirePermission } from "@/components/permission-guard";

export const Route = createFileRoute("/_authenticated/catalog")({
  component: () => (
    <RequirePermission module="catalog">
      <CatalogLayout />
    </RequirePermission>
  ),
});

function CatalogLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/catalog/spaces", label: "Spaces" },
    { to: "/catalog/food", label: "Food" },
    { to: "/catalog/beverages", label: "Beverages" },
    { to: "/catalog/extras", label: "Extras" },
    { to: "/catalog/staff", label: "Staff" },
    { to: "/catalog/rules", label: "Pricing rules" },
  ];
  return (
    <AppShell>
      <PageHeader title="Catalog" description="Spaces, packages, extras and pricing rules." />
      <div className="mb-6 flex gap-1 border-b">
        {tabs.map((t) => {
          const active = pathname === t.to;
          return (
            <Link
              key={t.to}
              to={t.to as string}
              className={`border-b-2 px-3 py-2 text-sm ${
                active ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </AppShell>
  );
}
