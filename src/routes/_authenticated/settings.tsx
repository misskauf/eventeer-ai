import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useTranslation } from "@/i18n";
import { usePermissions } from "@/lib/use-permissions";
import type { PermissionModule } from "@/lib/permissions";
import { RequirePermission } from "@/components/permission-guard";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => (
    <RequirePermission module={["settings", "team"]}>
      <SettingsLayout />
    </RequirePermission>
  ),
});

const SECTIONS: Array<{ to: string; label: string; module: PermissionModule }> = [
  { to: "/settings/company", label: "Company", module: "settings" },
  { to: "/settings/brand", label: "Brand", module: "settings" },
  { to: "/settings/team", label: "Team & users", module: "team" },
  { to: "/settings/workflow", label: "Deals & workflow", module: "settings" },
  { to: "/settings/fees", label: "Fees & tax", module: "settings" },
  { to: "/settings/contract-templates", label: "Contract templates", module: "contracts" },
  { to: "/settings/invoicing", label: "Invoicing", module: "invoices" },
  { to: "/settings/lead-forms", label: "Lead forms", module: "lead_forms" },
  { to: "/settings/language", label: "Language", module: "settings" },
];

function SettingsLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can } = usePermissions();
  const sections = SECTIONS.filter((s) => can(s.module, "view"));

  return (
    <AppShell>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <div className="mb-6 md:hidden">
        <select
          value={sections.find((s) => pathname === s.to)?.to ?? "/settings/company"}
          onChange={(e) => navigate({ to: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {sections.map((s) => (
            <option key={s.to} value={s.to}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-8">
        <nav className="hidden w-56 shrink-0 flex-col gap-0.5 md:flex">
          {sections.map((s) => {
            const active = pathname === s.to;
            return (
              <Link
                key={s.to}
                to={s.to as string}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </AppShell>
  );
}
