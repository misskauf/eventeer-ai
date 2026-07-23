import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveLeadForm, submitLeadForm } from "@/lib/lead-forms.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_FIELDS, type LeadFieldsConfig, type LeadFieldKey } from "@/lib/lead-forms";
import { toast } from "sonner";

export const Route = createFileRoute("/f/$slug")({
  ssr: false,
  component: PublicLeadForm,
  head: () => ({
    meta: [
      { title: "Event inquiry" },
      { name: "description", content: "Send us your event inquiry and we'll get back to you shortly." },
      { property: "og:title", content: "Event inquiry" },
      { property: "og:description", content: "Send us your event inquiry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
});

function PublicLeadForm() {
  const { slug } = Route.useParams();
  const resolve = useServerFn(resolveLeadForm);
  const submit = useServerFn(submitLeadForm);

  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ msg: string | null } | null>(null);

  useEffect(() => {
    resolve({ data: { slug } })
      .then(setState)
      .catch((e) => setError(e?.message ?? "Form unavailable"));
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full"><CardContent className="p-6 text-center text-sm text-muted-foreground">{error}</CardContent></Card>
      </div>
    );
  }
  if (!state) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const { form, company } = state;
  const fields: LeadFieldsConfig = form.fields;
  const brand = company?.primary_color || "#0f172a";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return toast.error("Please accept the consent");
    setBusy(true);
    try {
      const payload: any = {};
      for (const f of LEAD_FIELDS) {
        if (!fields[f.key].enabled) continue;
        const raw = values[f.key];
        if (raw === undefined || raw === "") continue;
        payload[f.key] = f.type === "number" ? Number(raw) : raw;
      }
      const res = await submit({ data: { slug, values: payload, consent: true } });
      if (res.redirect_url) {
        window.location.href = res.redirect_url;
        return;
      }
      setDone({ msg: res.success_text ?? "Thanks — we've received your inquiry and will be in touch shortly." });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            {company?.logo_url && <img src={company.logo_url} alt="" className="mx-auto max-h-16" />}
            <div className="text-lg font-semibold" style={{ color: brand }}>Thank you</div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{done.msg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-background">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="text-center space-y-2">
              {company?.logo_url && <img src={company.logo_url} alt={company?.name ?? ""} className="mx-auto max-h-16" />}
              <h1 className="text-xl font-semibold" style={{ color: brand }}>{form.name}</h1>
              {form.intro_text && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">{form.intro_text}</p>
              )}
            </div>

            <form className="space-y-3" onSubmit={onSubmit}>
              {LEAD_FIELDS.filter((f) => fields[f.key].enabled).map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key}>
                    {f.label}{fields[f.key].required && <span className="text-destructive"> *</span>}
                  </Label>
                  {f.type === "textarea" ? (
                    <Textarea
                      id={f.key}
                      required={fields[f.key].required}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      rows={4}
                    />
                  ) : (
                    <Input
                      id={f.key}
                      type={f.type}
                      required={fields[f.key].required}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

              <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                  className="mt-0.5"
                />
                <span className="text-muted-foreground">{form.consent_text}</span>
              </label>

              <Button type="submit" disabled={busy} className="w-full" style={{ backgroundColor: brand }}>
                {busy ? "Sending…" : "Send inquiry"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
