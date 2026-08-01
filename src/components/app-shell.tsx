import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, BookOpen, Settings, Sparkles, BarChart3 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationsBell } from "@/components/notifications-bell";
import { useTranslation, applyStoredLanguage } from "@/i18n";
import { usePermissions } from "@/lib/use-permissions";
import type { PermissionModule } from "@/lib/permissions";

type Company = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  currency: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [company, setCompany] = useState<Company | null>(null);
  const { can, loading: permLoading } = usePermissions();

  useEffect(() => {
    applyStoredLanguage();
  }, []);


  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: role } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();
      if (!role?.company_id) return;
      const { data } = await supabase
        .from("companies")
        .select("id, name, logo_url, primary_color, currency")
        .eq("id", role.company_id)
        .maybeSingle();
      setCompany(data as Company | null);
    })();
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  const nav: Array<{
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    match?: string;
    modules: PermissionModule[];
  }> = [
    { to: "/deals", label: t("nav.deals"), icon: LayoutDashboard, modules: ["deals"] },
    { to: "/analytics", label: "Analytics", icon: BarChart3, modules: ["analytics"] },
    {
      to: "/catalog/spaces",
      label: t("nav.catalog"),
      icon: BookOpen,
      match: "/catalog",
      modules: ["catalog"],
    },
    {
      to: "/settings",
      label: t("nav.settings"),
      icon: Settings,
      modules: ["settings", "team", "invoices", "lead_forms", "contracts"],
    },
  ].filter((n) => permLoading || n.modules.some((m) => can(m, "view")));


  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r bg-background md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <div
              className="grid h-8 w-8 place-items-center rounded text-sm font-semibold text-white"
              style={{ backgroundColor: company?.primary_color ?? "#0f172a" }}
            >
              {company?.name?.[0] ?? "P"}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{company?.name ?? t("nav.workspace")}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {nav.map((n) => {
            const active = pathname.startsWith(n.match ?? n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to as string}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> {t("nav.sign_out")}
          </Button>
        </div>
      </aside>
      <div className="md:pl-56">
        <header className="flex h-14 items-center justify-end gap-2 border-b bg-background px-6">
          <NotificationsBell />
        </header>
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-md bg-muted text-muted-foreground">
        {icon ?? <Sparkles className="h-5 w-5" />}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
