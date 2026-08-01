import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveLeadForm, submitLeadForm } from "@/lib/lead-forms.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getEnabledPresetFields,
  type LeadFieldsConfig,
  type CustomFieldDef,
} from "@/lib/lead-forms";
import { toast } from "sonner";
import { useTranslation, applyStoredLanguage } from "@/i18n";

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
  const { t } = useTranslation();
  const resolve = useServerFn(resolveLeadForm);
  const submit = useServerFn(submitLeadForm);

  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ msg: string | null } | null>(null);

  useEffect(() => {
    applyStoredLanguage();
  }, []);

  useEffect(() => {
    resolve({ data: { slug } })
      .then(setState)
      .catch((e) => setError(e?.message ?? t("leadForm.unavailable")));
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full"><CardContent className="p-6 text-center text-sm text-muted-foreground">{error}</CardContent></Card>
      </div>
    );
  }
  if (!state) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">{t("leadForm.loading")}</div>;
  }

  const { form, company } = state;
  const fields: LeadFieldsConfig = form.fields;
  const brand = company?.primary_color || "#0f172a";
  const enabledPresets = getEnabledPresetFields(fields);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return toast.error(t("leadForm.consent_required"));
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of enabledPresets) {
        const raw = values[f.key];
        if (raw === undefined || raw === "") continue;
        payload[f.key] = f.type === "number" ? Number(raw) : raw;
      }
      for (const c of fields.custom) {
        const raw = values[c.key];
        if (c.type === "checkbox") {
          payload[c.key] = !!raw;
          continue;
        }
        if (raw === undefined || raw === "") continue;
        payload[c.key] = c.type === "number" ? Number(raw) : raw;
      }
      const res = await submit({ data: { slug, values: payload, consent: true } });
      if (res.redirect_url) {
        window.location.href = res.redirect_url;
        return;
      }
      setDone({ msg: res.success_text ?? t("leadForm.default_success") });
    } catch (err: any) {
      toast.error(err?.message ?? t("leadForm.submit_failed"));
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
            <div className="text-lg font-semibold" style={{ color: brand }}>{t("leadForm.thank_you")}</div>
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
              {enabledPresets.map((f) => {
                const cfg = fields.preset[f.key];
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key}>
                      {f.label}{cfg.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        id={f.key}
                        required={cfg.required}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        rows={4}
                      />
                    ) : (
                      <Input
                        id={f.key}
                        type={f.type as string}
                        required={cfg.required}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}

              {fields.custom.map((c) => (
                <CustomFieldInput
                  key={c.id}
                  def={c}
                  value={values[c.key]}
                  onChange={(v) => setValues((prev) => ({ ...prev, [c.key]: v }))}
                />
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
                {busy ? t("leadForm.sending") : t("leadForm.send_inquiry")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CustomFieldInput({
  def,
  value,
  onChange,
}: {
  def: CustomFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `cf_${def.id}`;
  const req = def.required;
  const label = (
    <Label htmlFor={id}>
      {def.label}{req && <span className="text-destructive"> *</span>}
    </Label>
  );
  if (def.type === "textarea") {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea id={id} required={req} placeholder={def.placeholder} rows={4}
          value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        {def.help && <p className="text-xs text-muted-foreground">{def.help}</p>}
      </div>
    );
  }
  if (def.type === "checkbox") {
    return (
      <label className="flex items-start gap-2 text-sm">
        <input id={id} type="checkbox" required={req} checked={!!value} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
        <span>{def.label}{req && <span className="text-destructive"> *</span>}{def.help && <span className="block text-xs text-muted-foreground">{def.help}</span>}</span>
      </label>
    );
  }
  if (def.type === "select") {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          id={id}
          required={req}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {(def.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {def.help && <p className="text-xs text-muted-foreground">{def.help}</p>}
      </div>
    );
  }
  const inputType = def.type === "number" ? "number" : def.type === "date" ? "date" : "text";
  return (
    <div className="space-y-1.5">
      {label}
      <Input
        id={id}
        type={inputType}
        required={req}
        placeholder={def.placeholder}
        value={(value as string | number | undefined) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {def.help && <p className="text-xs text-muted-foreground">{def.help}</p>}
    </div>
  );
}
