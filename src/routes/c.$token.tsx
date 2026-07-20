import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getContractByToken, signContract } from "@/lib/contracts.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatEventDate } from "@/lib/date-format";
import { toast } from "sonner";
import { CheckCircle2, FileText } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { ensureHtml } from "@/lib/contracts";

export const Route = createFileRoute("/c/$token")({
  ssr: false,
  component: ClientSigning,
  head: () => ({ meta: [{ title: "Sign contract" }] }),
});

function ClientSigning() {
  const { token } = Route.useParams();
  const resolve = useServerFn(getContractByToken);
  const sign = useServerFn(signContract);

  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  useEffect(() => {
    resolve({ data: { token } })
      .then((r: any) => {
        if (!r.ok) setError(r.reason ?? "not_found");
        else {
          setState(r);
          if (r.contract.signed_at) setSignedAt(r.contract.signed_at);
        }
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, [token, resolve]);

  async function onSign() {
    if (!typedName.trim() || !agreed) return;
    setBusy(true);
    try {
      const r: any = await sign({ data: { token, typed_name: typedName.trim(), agreed: true } });
      if (r.ok) {
        setSignedAt(r.signed_at);
        toast.success("Contract signed");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to sign");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Link not available</h1>
        <p className="mt-2 text-muted-foreground">
          {error === "expired"
            ? "This signing link has expired. Please contact the event manager for a fresh link."
            : error === "not_available"
              ? "This contract is no longer available for signing."
              : "We couldn't find this contract."}
        </p>
      </div>
    );
  }

  if (!state) {
    return <div className="mx-auto max-w-xl px-6 py-16 text-center text-muted-foreground">Loading…</div>;
  }

  const { contract, company, deal } = state;
  const isSigned = !!signedAt;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        {company?.logo_url ? (
          <img src={company.logo_url} alt="" className="h-10 w-10 rounded object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
        )}
        <div>
          <div className="text-sm text-muted-foreground">{company?.name}</div>
          <h1 className="text-xl font-semibold">{contract.template_name || "Event contract"}</h1>
        </div>
      </div>

      {deal && (
        <Card className="mb-4">
          <CardContent className="grid grid-cols-2 gap-3 py-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Client</div>
              <div className="font-medium">{deal.client_name || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Company</div>
              <div className="font-medium">{deal.client_company || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Event date</div>
              <div className="font-medium">
                {deal.event_date ? formatEventDate(deal.event_date) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Guests</div>
              <div className="font-medium">{deal.guest_count ?? "—"}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto rounded-md border bg-background p-4 dark:prose-invert"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(ensureHtml(contract.rendered_body ?? "")),
            }}
          />
        </CardContent>
      </Card>

      {isSigned ? (
        <Card className="mt-4 border-green-600/40 bg-green-50 dark:bg-green-950/20">
          <CardContent className="flex items-start gap-3 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
            <div className="text-sm">
              <div className="font-medium">Contract signed</div>
              <div className="text-muted-foreground">
                Signed by {contract.signed_by_name ?? typedName} on{" "}
                {new Date(signedAt!).toLocaleString()}. A copy has been saved by {company?.name}.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Sign contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="typed">Full legal name</Label>
              <Input
                id="typed"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your full name to sign"
              />
              {typedName.trim() && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 font-[cursive] text-2xl">
                  {typedName}
                </div>
              )}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <span>
                I have read the contract above and agree to be legally bound by its terms. Typing my
                name and clicking Sign constitutes my electronic signature.
              </span>
            </label>
            <div className="flex justify-end">
              <Button onClick={onSign} disabled={!typedName.trim() || !agreed || busy}>
                {busy ? "Signing…" : "Sign contract"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
