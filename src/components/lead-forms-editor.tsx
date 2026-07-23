import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_FIELDS, LEAD_FIELDS, normalizeFields, type LeadFieldsConfig, type LeadFieldKey } from "@/lib/lead-forms";

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

function slugify(s: string) {
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
      fields: { ...DEFAULT_FIELDS },
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
      slug: slugify(form.slug) || slugify(form.name) || `form-${Date.now()}`,
      fields: form.fields as any,
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
  const setField = (key: LeadFieldKey, patch: Partial<{ enabled: boolean; required: boolean }>) =>
    setF((prev) => ({ ...prev, fields: { ...prev.fields, [key]: { ...prev.fields[key], ...patch } } }));

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
          <div className="text-sm font-medium">Fields</div>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs uppercase text-muted-foreground">
            <div>Field</div><div>Show</div><div>Required</div>
          </div>
          {LEAD_FIELDS.map((meta) => (
            <div key={meta.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 text-sm">
              <div>{meta.label}</div>
              <input
                type="checkbox"
                checked={f.fields[meta.key].enabled}
                onChange={(e) => setField(meta.key, { enabled: e.target.checked, required: e.target.checked && f.fields[meta.key].required })}
              />
              <input
                type="checkbox"
                checked={f.fields[meta.key].required}
                disabled={!f.fields[meta.key].enabled}
                onChange={(e) => setField(meta.key, { required: e.target.checked })}
              />
            </div>
          ))}
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

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
          Active (accepts submissions)
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave(f)}>Save form</Button>
        </div>
      </CardContent>
    </Card>
  );
}
