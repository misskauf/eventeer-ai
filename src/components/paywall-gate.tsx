import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Lock, LogOut } from "lucide-react";
import { usePermissions } from "@/lib/use-permissions";
import { useSubscription } from "@/lib/use-subscription";
import { BILLING_CONTACT_EMAIL, TRIAL_DAYS } from "@/lib/billing";
import { usePlatformAdmin } from "@/lib/use-platform-admin";

/**
 * Gates the authenticated app on the company's subscription:
 * active/comped → pass through, trialing → banner, expired → paywall.
 * Never deletes or hides data server-side; this is access gating only.
 */
export function PaywallGate({ children }: { children: React.ReactNode }) {
  const { locked, isTrialing, daysLeft, loading } = useSubscription();
  const { isOwner } = usePermissions();
  const { isPlatformAdmin } = usePlatformAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  if (loading || isPlatformAdmin) return <>{children}</>;

  if (locked) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card>
          <CardHeader>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-md bg-muted text-muted-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <CardTitle>
              {isOwner ? `Your ${TRIAL_DAYS}-day free trial has ended` : "Trial ended"}
            </CardTitle>
            <CardDescription>
              {isOwner
                ? `To keep using EventFlow, please subscribe — contact ${BILLING_CONTACT_EMAIL}.`
                : "Your team’s trial has ended — ask your account owner to subscribe."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>All your data is safe and untouched. Access resumes as soon as the account is activated.</p>
            <div className="flex flex-wrap gap-2">
              {isOwner && (
                <>
                  <Button asChild>
                    <a href={`mailto:${BILLING_CONTACT_EMAIL}?subject=EventFlow subscription`}>
                      Contact us to subscribe
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/settings/company">Account settings</Link>
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {isTrialing && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span>
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left in your free trial.
          </span>
          {isOwner && (
            <a
              className="ml-auto font-medium underline underline-offset-4"
              href={`mailto:${BILLING_CONTACT_EMAIL}?subject=EventFlow subscription`}
            >
              Subscribe
            </a>
          )}
        </div>
      )}
      {children}
    </>
  );
}
