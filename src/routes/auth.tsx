import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-brand";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvites } from "@/lib/team.functions";
import { LegalLinks } from "@/components/legal-content";
import { Checkbox } from "@/components/ui/checkbox";
import { recordTermsAcceptance } from "@/lib/terms.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},

  component: AuthPage,
});

function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  // Same-origin relative paths only.
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const acceptPendingInvites = useServerFn(acceptInvites);
  const acceptTerms = useServerFn(recordTermsAcceptance);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsError, setTermsError] = useState(false);

  async function goNext(fallback: "/deals" | "/onboarding") {
    const target = safeNext(next);
    if (target) {
      window.location.href = target;
      return;
    }
    await navigate({ to: fallback });
  }

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: fd.get("email") as string,
      password: fd.get("password") as string,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    // Join any company that invited this address.
    try {
      await acceptPendingInvites({ data: {} });
    } catch {
      /* no pending invite */
    }
    await goNext("/deals");
  }

  async function onSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!termsChecked) {
      setTermsError(true);
      toast.error("Bitte akzeptieren Sie die AGB und die AVV, um ein Konto zu erstellen.");
      return;
    }
    setTermsError(false);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const target = safeNext(next);
    const emailRedirectTo = window.location.origin + (target ?? "/onboarding");
    const { error } = await supabase.auth.signUp({
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      options: { emailRedirectTo },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    // Store the acceptance for the freshly created account (best effort: needs a session).
    try {
      await acceptTerms({});
    } catch {
      /* no session yet (email confirmation pending) — captured again before onboarding */
    }
    toast.success("Account created. Check your email if confirmation is required.");
    await goNext("/onboarding");
  }

  async function onGoogle() {
    setBusy(true);
    const target = safeNext(next);
    const redirect_uri = window.location.origin + (target ?? "");
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri,
    });
    if (res.error) {
      setBusy(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (!res.redirected) {
      await goNext("/onboarding");
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <img
            src="/eventeer-logo.svg"
            alt={`${APP_NAME} logo`}
            className="mb-2 h-9 w-auto self-start"
            width={376}
            height={96}
          />
          <CardTitle>Welcome to {APP_NAME}</CardTitle>
          <CardDescription>Sign in or create your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form className="mt-4 space-y-3" onSubmit={onSignIn}>
                <Field name="email" label="Email" type="email" />
                <Field name="password" label="Password" type="password" />
                <Button className="w-full" disabled={busy}>
                  Sign in
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form className="mt-4 space-y-3" onSubmit={onSignUp}>
                <Field name="email" label="Work email" type="email" />
                <Field name="password" label="Password" type="password" />
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={termsChecked}
                    onCheckedChange={(v) => {
                      setTermsChecked(v === true);
                      if (v === true) setTermsError(false);
                    }}
                    className="mt-0.5"
                    aria-invalid={termsError}
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
                {termsError ? (
                  <p className="text-sm text-destructive">
                    Bitte akzeptieren Sie die AGB und die AVV, um fortzufahren.
                  </p>
                ) : null}
                <Button className="w-full" disabled={busy}>
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
      <LegalLinks className="mt-4" />
    </div>
  );
}

function Field({ name, label, type }: { name: string; label: string; type: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required />
    </div>
  );
}
