import { Link, useRouterState } from "@tanstack/react-router";

export function DealsTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/deals", label: "List", exact: true },
    { to: "/deals/calendar", label: "Calendar", exact: false },
  ] as const;
  return (
    <div className="mb-6 flex gap-1 border-b">
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
  );
}
