import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/deals")({
  component: DealsLayout,
});

function DealsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/deals", label: "List", exact: true },
    { to: "/deals/calendar", label: "Calendar", exact: false },
  ] as const;
  return (
    <>
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl gap-1 px-6">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`border-b-2 px-3 py-2 text-sm ${
                  active
                    ? "border-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <Outlet />
    </>
  );
}
