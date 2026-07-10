import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setHasCompany(!!data?.company_id));
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" />;
  if (hasCompany === true) return <Navigate to="/deals" />;
  if (hasCompany === null) return null;

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.rpc("create_company_workspace", {
      _name: fd.get("name") as string,
      _primary_color: (fd.get("primary_color") as string) || "#0f172a",
      _currency: (fd.get("currency") as string) || "USD",
    });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    toast.success("Workspace created");
    await navigate({ to: "/deals" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>Set up your venue or event business.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onCreate}>
            <div className="space-y-1.5">
              <Label htmlFor="name">Company name</Label>
              <Input id="name" name="name" required placeholder="Riverside Events" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="primary_color">Brand color</Label>
                <Input
                  id="primary_color"
                  name="primary_color"
                  type="color"
                  defaultValue="#0f172a"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" defaultValue="USD" maxLength={3} />
              </div>
            </div>
            <Button className="w-full" disabled={busy}>
              Create workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
