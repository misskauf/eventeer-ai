import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Pencil, Plus, Trash2, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import {
  defaultFieldsConfig,
  normalizeFields,
  PRESET_FIELDS,
  slugKey,
  cryptoRandomId,
  type LeadFieldsConfig,
  type PresetFieldKey,
  type CustomFieldDef,
  type CustomFieldType,
} from "@/lib/lead-forms";

type LeadForm = {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  fields: LeadFieldsConfig;
  intro_text: string | null;
  success_text: string | null;
  redirect_url: string | null;
  consent_text: string;
  active: boolean;
};

function slugifySlug(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function LeadFormsEditor({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<LeadForm[]>([]);
  const [editing, setEditing] = useState<LeadForm | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_forms")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(
      (data ?? []).map((r: any) => ({ ...r, fields: normalizeFields(r.fields) })),
    );
    setLoading(false);
  }
  useEffect(() => { load(); }, [companyId]);

  function makeNew(): LeadForm {
    const base = "inquiry";
    let slug = base;
    let i = 2;
    const existing = new Set(rows.map((r) => r.slug));
    while (existing.has(slug)) slug = `${base}-${i++}`;
    return {
      id: "",
      company_id: companyId,
      name: "Event inquiry",
      slug,
      fields: defaultFieldsConfig(),
      intro_text: "Tell us about your event and we'll get back to you shortly.",
      success_text: "Thanks — we've received your inquiry and will be in touch shortly.",
      redirect_url: null,
      consent_text:
        "I agree to be contacted about my event inquiry and to the processing of my data per the privacy policy.",
      active: true,
    };
  }

  async function save(form: LeadForm) {
    const payload = {
      company_id: companyId,
      name: form.name.trim() || "Untitled",
      slug: slugifySlug(form.slug) || slugifySlug(form.name) || `form-${Date.now()}`,
      fields: {
        ...form.fields,
        custom: form.fields.custom.map((c) =>
          c.type === "select"
            ? { ...c, options: (c.options ?? []).map((o) => o.trim()).filter(Boolean) }
            : { ...c, options: undefined },
        ),
      } as any,
      intro_text: form.intro_text?.trim() || null,
      success_text: form.success_text?.trim() || null,
      redirect_url: form.redirect_url?.trim() || null,
      consent_text: form.consent_text.trim() || "I consent to being contacted.",
      active: form.active,
    };
    if (form.id) {
      const { error } = await supabase.from("lead_forms").update(payload as any).eq("id", form.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("lead_forms").insert(payload as any);
      if (error) return toast.error(error.message);
    }
    toast.success("Form saved");
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this form?")) return;
    const { error } = await supabase.from("lead_forms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  if (editing) return <LeadFormEditForm value={editing} onCancel={() => setEditing(null)} onSave={save} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing(makeNew())}>
          <Plus className="mr-1 h-4 w-4" /> New form
        </Button>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground rounded-md border p-4 text-center">
          No lead forms yet. Create one to embed on your website.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <LeadFormRow key={r.id} row={r} onEdit={() => setEditing(r)} onDelete={() => remove(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadFormRow({ row, onEdit, onDelete }: { row: LeadForm; onEdit: () => void; onDelete: () => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/f/${row.slug}`;
  const iframe = `<iframe src="${link}" style="width:100%;max-width:640px;height:820px;border:0;" loading="lazy"></iframe>`;
  const script = `<div id="lovable-lead-form-${row.slug}"></div>
<script>(function(){var d=document,i=d.createElement('iframe');i.src='${link}';i.style.cssText='width:100%;max-width:640px;height:820px;border:0';i.loading='lazy';d.getElementById('lovable-lead-form-${row.slug}').appendChild(i);})();</script>`;

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">{row.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              /f/{row.slug} {row.active ? "" : "· inactive"}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="space-y-2">
          <SnippetRow label="Shareable link" value={link} onCopy={() => copy(link, "Link")} extra={
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs underline text-muted-foreground">
              Open <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          } />
          <SnippetRow label="Embed (iframe)" value={iframe} onCopy={() => copy(iframe, "Embed code")} multiline />
          <SnippetRow label="One-line script" value={script} onCopy={() => copy(script, "Script")} multiline />
        </div>
      </CardContent>
    </Card>
  );
}

function SnippetRow({ label, value, onCopy, multiline, extra }: { label: string; value: string; onCopy: () => void; multiline?: boolean; extra?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
          {extra}
          <Button size="sm" variant="ghost" onClick={onCopy}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
        </div>
      </div>
      {multiline ? (
        <Textarea value={value} readOnly rows={2} className="font-mono text-xs" />
      ) : (
        <Input value={value} readOnly className="font-mono text-xs" />
      )}
    </div>
  );
}

function LeadFormEditForm({ value, onCancel, onSave }: { value: LeadForm; onCancel: () => void; onSave: (v: LeadForm) => void }) {
  const [f, setF] = useState<LeadForm>(value);
  const set = (patch: Partial<LeadForm>) => setF((prev) => ({ ...prev, ...patch }));
  const setPreset = (key: PresetFieldKey, patch: Partial<{ enabled: boolean; required: boolean }>) =>
    setF((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        preset: { ...prev.fields.preset, [key]: { ...prev.fields.preset[key], ...patch } },
      },
    }));

  function updateCustom(id: string, patch: Partial<CustomFieldDef>) {
    setF((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        custom: prev.fields.custom.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    }));
  }
  function addCustom() {
    const def: CustomFieldDef = {
      id: cryptoRandomId(),
      key: `field_${f.fields.custom.length + 1}`,
      label: "New question",
      type: "text",
      required: false,
    };
    setF((prev) => ({ ...prev, fields: { ...prev.fields, custom: [...prev.fields.custom, def] } }));
  }
  function removeCustom(id: string) {
    setF((prev) => ({ ...prev, fields: { ...prev.fields, custom: prev.fields.custom.filter((c) => c.id !== id) } }));
  }
  function moveCustom(id: string, dir: -1 | 1) {
    setF((prev) => {
      const arr = [...prev.fields.custom];
      const i = arr.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...prev, fields: { ...prev.fields, custom: arr } };
    });
  }

  
  const dupKey = f.fields.custom.some((c, i) => f.fields.custom.findIndex((x) => x.key === c.key) !== i);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Form name</Label>
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug (URL)</Label>
            <Input value={f.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="event-inquiry" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Intro text</Label>
          <Textarea rows={2} value={f.intro_text ?? ""} onChange={(e) => set({ intro_text: e.target.value })} />
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Standard fields</div>
            <div className="text-xs text-muted-foreground">
              “Show” puts the field on the form. “Required” means visitors must fill it in.
            </div>
          </div>
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <div>Field</div>
              <div className="text-center">Show</div>
              <div className="text-center">Required</div>
            </div>
            {PRESET_FIELDS.map((meta, i) => {
              const cfg = f.fields.preset[meta.key];
              return (
                <div
                  key={meta.key}
                  className={`grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-t px-3 py-2 text-sm ${
                    i % 2 === 1 ? "bg-muted/30" : ""
                  }`}
                >
                  <Label htmlFor={`show-${meta.key}`} className="font-normal cursor-pointer">
                    {meta.label}
                  </Label>
                  <div className="flex justify-center">
                    <Checkbox
                      id={`show-${meta.key}`}
                      checked={cfg.enabled}
                      onCheckedChange={(v) => setPreset(meta.key, { enabled: !!v, required: !!v && cfg.required })}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Checkbox
                      id={`req-preset-${meta.key}`}
                      checked={cfg.required}
                      disabled={!cfg.enabled}
                      onCheckedChange={(v) => setPreset(meta.key, { required: !!v })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Custom questions</div>
              <div className="text-xs text-muted-foreground">Add your own fields. Answers are saved on the deal.</div>
            </div>
            <Button size="sm" variant="outline" onClick={addCustom}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add field
            </Button>
          </div>

          {f.fields.custom.length === 0 ? (
            <div className="text-xs text-muted-foreground">No custom fields yet.</div>
          ) : (
            <div className="space-y-3">
              {f.fields.custom.map((c, idx) => (
                <div key={c.id} className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">Field {idx + 1}</div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => moveCustom(c.id, -1)} disabled={idx === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => moveCustom(c.id, 1)} disabled={idx === f.fields.custom.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeCustom(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={c.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          // auto-sync key from label if key looks auto-derived
                          const autoKey = slugKey(c.label);
                          const patch: Partial<CustomFieldDef> = { label };
                          if (!c.key || c.key === autoKey) patch.key = slugKey(label) || c.key;
                          updateCustom(c.id, patch);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <select
                        value={c.type}
                        onChange={(e) => {
                          const type = e.target.value as CustomFieldType;
                          updateCustom(c.id, {
                            type,
                            options: type === "select" ? (c.options && c.options.length ? c.options : [""]) : undefined,
                          });
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="text">Short text</option>
                        <option value="textarea">Long text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="select">Dropdown (select)</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs">Placeholder</Label>
                      <Input
                        value={c.placeholder ?? ""}
                        onChange={(e) => updateCustom(c.id, { placeholder: e.target.value })}
                        placeholder="e.g. 120 guests"
                      />
                      <p className="text-xs text-muted-foreground">
                        Example text shown in grey inside the empty box (e.g. “e.g. 120 guests”).
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-sm md:pt-7">
                      <Checkbox
                        id={`req-${c.id}`}
                        checked={c.required}
                        onCheckedChange={(v) => updateCustom(c.id, { required: !!v })}
                      />
                      <Label htmlFor={`req-${c.id}`} className="font-normal">Required</Label>
                    </div>
                  </div>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => toggleAdvanced(c.id)}
                    >
                      {advanced.has(c.id) ? "Hide advanced" : "Advanced"}
                    </Button>
                    {advanced.has(c.id) && (
                      <div className="mt-2 space-y-1.5">
                        <Label className="text-xs">Key (data name)</Label>
                        <Input value={c.key} readOnly className="font-mono text-xs bg-muted/50" />
                        <p className="text-xs text-muted-foreground">
                          Generated automatically from the label. Used to store the answer on the deal.
                        </p>
                      </div>
                    )}
                  </div>

                  {c.type === "select" && (
                    <OptionsEditor
                      options={c.options ?? [""]}
                      onChange={(options) => updateCustom(c.id, { options })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {dupKey && (
            <div className="text-xs text-destructive">Two custom fields share the same key — please make them unique.</div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>GDPR consent text (required checkbox)</Label>
          <Textarea rows={2} value={f.consent_text} onChange={(e) => set({ consent_text: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label>Success message</Label>
          <Textarea rows={2} value={f.success_text ?? ""} onChange={(e) => set({ success_text: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label>Redirect URL after submit (optional)</Label>
          <Input value={f.redirect_url ?? ""} onChange={(e) => set({ redirect_url: e.target.value })} placeholder="https://yoursite.com/thanks" />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Checkbox id="form-active" checked={f.active} onCheckedChange={(v) => set({ active: !!v })} />
          <Label htmlFor="form-active">Active (accepts submissions)</Label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave(f)} disabled={dupKey}>Save form</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (v: string[]) => void }) {
  const list = options.length ? options : [""];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Options</Label>
      <div className="space-y-2">
        {list.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={o}
              placeholder={`Option ${i + 1}`}
              onChange={(e) => {
                const next = [...list];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              disabled={list.length === 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" type="button" onClick={() => onChange([...list, ""])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add option
      </Button>
    </div>
  );
}
