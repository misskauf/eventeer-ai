import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { getMySubscription, openBillingPortal } from "@/lib/billing.functions";
import { SubscribeButton } from "@/components/paywall-gate";
import { usePermissions } from "@/lib/use-permissions";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

/** Owner-facing subscription status + Stripe Checkout / Billing Portal actions. */
export function SubscriptionCard() {
  const { isOwner, loading } = usePermissions();
  const fetchSub = useServerFn(getMySubscription);
  const portal = useServerFn(openBillingPortal);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
    enabled: isOwner,
  });

  if (loading || !isOwner) return null;

  async function openPortal() {
    setBusy(true);
    try {
      const { url } = await portal({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open the billing portal.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage your plan, payment method and invoices.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant={data.status === "active" ? "default" : "secondary"}>{data.status}</Badge>
              {data.plan_label && <span className="text-muted-foreground">{data.plan_label}</span>}
              {data.status === "trialing" && (
                <span className="text-muted-foreground">Trial ends {fmt(data.trial_ends_at)}</span>
              )}
              {data.has_subscription && data.current_period_end && (
                <span className="text-muted-foreground">Renews {fmt(data.current_period_end)}</span>
              )}
            </div>

            {!data.billing_configured ? (
              <p className="text-sm text-muted-foreground">
                Online subscription payment isn’t available yet — please contact us to activate your account.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {!data.has_subscription && <SubscribeButton label="Subscribe" />}
                {data.has_customer && (
                  <Button variant="outline" onClick={openPortal} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Manage billing
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
