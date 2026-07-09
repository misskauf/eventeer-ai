import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", data.user.id)
      .limit(1)
      .maybeSingle();
    if (!role?.company_id) throw redirect({ to: "/onboarding" });
    return { user: data.user, companyId: role.company_id };
  },
  component: () => <Outlet />,
});
