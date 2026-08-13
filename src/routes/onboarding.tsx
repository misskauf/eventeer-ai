import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth-hooks";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvites } from "@/lib/team.functions";
import { hasTermsAcceptance, recordTermsAcceptance } from "@/lib/terms.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencySelect } from "@/components/currency-select";
import { DEFAULT_CURRENCY } from "@/lib/currencies";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);
  const [termsOk, setTermsOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const acceptPendingInvites = useServerFn(acceptInvites);
  const checkTerms = useServerFn(hasTermsAcceptance);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Pick up any invitation sent to this address before offering workspace creation.
      try {
        await acceptPendingInvites({ data: {} });
      } catch {
        /* no pending invite */
      }
      const { data } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setHasCompany(!!data?.company_id);
      try {
        const res = await checkTerms({});
        setTermsOk(res.accepted);
      } catch {
        setTermsOk(true);
      }
    })();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" />;
  if (hasCompany === true) return <Navigate to="/deals" />;
  if (hasCompany === null || termsOk === null) return null;
  if (!termsOk) return <TermsStep onDone={() => setTermsOk(true)} />;

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.rpc("create_company_workspace", {
      _name: fd.get("name") as string,
      _primary_color: (fd.get("primary_color") as string) || "#0f172a",
      _currency: (fd.get("currency") as string) || DEFAULT_CURRENCY,
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
                <CurrencySelect id="currency" name="currency" />
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

/** Shown to new sign-ups (e.g. via Google) who have not accepted AGB/AVV yet. */
function TermsStep({ onDone }: { onDone: () => void }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const accept = useServerFn(recordTermsAcceptance);

  async function submit() {
    if (!checked) {
      toast.error("Bitte akzeptieren Sie die AGB und die AVV, um fortzufahren.");
      return;
    }
    setBusy(true);
    try {
      await accept({});
      onDone();
    } catch {
      toast.error("Could not record your acceptance. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Terms &amp; data processing</CardTitle>
          <CardDescription>Please accept before creating your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <span>
              Ich akzeptiere die{" "}
              <a href="/agb" target="_blank" rel="noreferrer" className="underline">
                AGB
              </a>{" "}
              und die{" "}
              <a href="/avv" target="_blank" rel="noreferrer" className="underline">
                Vereinbarung zur Auftragsverarbeitung (AVV)
              </a>
              .
            </span>
          </label>
          <Button className="w-full" disabled={busy} onClick={submit}>
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
