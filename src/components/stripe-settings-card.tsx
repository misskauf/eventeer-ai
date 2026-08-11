import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  getStripeStatus,
  removeStripeCredentials,
  saveStripeCredentials,
  saveStripeSettings,
} from "@/lib/stripe-settings.functions";

type Props = {
  companyId: string;
  stripeEnabled: boolean;
  publishableKey: string | null;
};

/**
 * Per-venue Stripe setup. The secret key is write-only: it is sent once to the
 * server, encrypted at rest, and never read back into the browser.
 */
export function StripeSettingsCard({ companyId, stripeEnabled, publishableKey }: Props) {
  const status = useServerFn(getStripeStatus);
  const saveCreds = useServerFn(saveStripeCredentials);
  const saveSettings = useServerFn(saveStripeSettings);
  const removeCreds = useServerFn(removeStripeCredentials);

  const [info, setInfo] = useState<any>(null);
  const [pk, setPk] = useState(publishableKey ?? "");
  const [sk, setSk] = useState("");
  const [whsec, setWhsec] = useState("");
  const [enabled, setEnabled] = useState(stripeEnabled);
  const [busy, setBusy] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/webhooks/stripe/${companyId}`
      : "";

  async function refresh() {
    try {
      setInfo(await status({ data: { companyId } }));
    } catch {
      /* no settings access — card is not rendered in that case */
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function onSaveKeys() {
    if (!sk && !whsec) return toast.error("Nothing to save.");
    setBusy(true);
    try {
      await saveCreds({
        data: {
          companyId,
          ...(sk ? { secretKey: sk.trim() } : {}),
          ...(whsec ? { webhookSecret: whsec.trim() } : {}),
        },
      });
      setSk("");
      setWhsec("");
      toast.success("Stripe keys saved");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save the keys");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveSettings(nextEnabled = enabled) {
    setBusy(true);
    try {
      await saveSettings({
        data: { companyId, publishableKey: pk.trim() || null, enabled: nextEnabled },
      });
      setEnabled(nextEnabled);
      toast.success(nextEnabled ? "Card payments enabled" : "Card payments saved");
    } catch (err: any) {
      setEnabled((v) => v);
      toast.error(err?.message ?? "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await removeCreds({ data: { companyId } });
      setEnabled(false);
      toast.success("Stripe credentials removed");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Card &amp; SEPA payments (Stripe)
          {info?.configured && (
            <Badge variant="secondary">{info.mode === "live" ? "Live" : "Test"}</Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Optional. Clients pay by card or SEPA directly into your own Stripe account — we never
          hold your money and never see your secret key after you save it.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Offer card / SEPA on the payment page</div>
            <div className="text-xs text-muted-foreground">
              Bank transfer details stay visible either way.
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={busy || !info?.configured}
            onCheckedChange={(v) => onSaveSettings(v)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Publishable key</label>
          <Input value={pk} onChange={(e) => setPk(e.target.value)} placeholder="pk_live_…" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">
            Secret key {info?.configured && <span className="text-muted-foreground">(saved · ••••{info.last4})</span>}
          </label>
          <Input
            type="password"
            autoComplete="off"
            value={sk}
            onChange={(e) => setSk(e.target.value)}
            placeholder={info?.configured ? "Enter a new key to replace it" : "sk_live_…"}
          />
          <p className="text-xs text-muted-foreground">
            Stored encrypted and used only on our server. It is never sent to browsers.
          </p>
        </div>

        <div className="space-y-1.5 rounded-md border p-3">
          <div className="text-sm font-medium">Webhook</div>
          <p className="text-xs text-muted-foreground">
            In Stripe → Developers → Webhooks, add this endpoint for the events
            <span className="font-mono"> checkout.session.completed</span>,
            <span className="font-mono"> checkout.session.async_payment_succeeded</span> and
            <span className="font-mono"> payment_intent.succeeded</span>, then paste the signing
            secret below.
          </p>
          <Input readOnly value={webhookUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Input
            type="password"
            autoComplete="off"
            value={whsec}
            onChange={(e) => setWhsec(e.target.value)}
            placeholder={info?.hasWebhookSecret ? "Saved — enter a new one to replace" : "whsec_…"}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSaveKeys} disabled={busy}>
            Save Stripe keys
          </Button>
          <Button variant="outline" onClick={() => onSaveSettings()} disabled={busy}>
            Save publishable key
          </Button>
          {info?.configured && (
            <Button variant="ghost" onClick={onRemove} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
