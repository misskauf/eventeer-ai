import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Upload, Pencil } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ContractUploadDialog } from "@/components/contract-upload-dialog";
import { ensureHtml } from "@/lib/contracts";
import { DEFAULT_INVOICE_TEMPLATE } from "@/lib/invoices";
import DOMPurify from "isomorphic-dompurify";

type Template = { id: string; name: string; body: string; is_default: boolean };

export function InvoiceTemplatesEditor({ companyId }: { companyId: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  async function refresh() {
    const { data } = await supabase
      .from("invoice_templates" as any)
      .select("id, name, body, is_default")
      .eq("company_id", companyId)
      .order("is_default", { ascending: false })
      .order("name");
    setTemplates(((data as any) ?? []) as Template[]);
  }
  useEffect(() => {
    if (companyId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function openNew() {
    setEditing(null);
    setName("");
    setBody(DEFAULT_INVOICE_TEMPLATE);
    setIsDefault(templates.length === 0);
    setDialogOpen(true);
  }
  function openEdit(t: Template) {
    setEditing(t);
    setName(t.name);
    setBody(ensureHtml(t.body));
    setIsDefault(t.is_default);
    setDialogOpen(true);
  }
  function openDuplicate(t: Template) {
    setEditing(null);
    setName(`${t.name} (copy)`);
    setBody(ensureHtml(t.body));
    setIsDefault(false);
    setDialogOpen(true);
  }
  function openFromUpload(r: { name: string; html: string }) {
    setEditing(null);
    setName(r.name);
    setBody(r.html);
    setIsDefault(templates.length === 0);
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) return toast.error("Name is required");
    if (isDefault) {
      await supabase
        .from("invoice_templates" as any)
        .update({ is_default: false } as any)
        .eq("company_id", companyId);
    }
    const payload = { name: name.trim(), body, is_default: isDefault };
    const { error } = editing
      ? await supabase.from("invoice_templates" as any).update(payload as any).eq("id", editing.id)
      : await supabase.from("invoice_templates" as any).insert({ ...payload, company_id: companyId } as any);
    if (error) return toast.error(error.message);
    toast.success("Template saved");
    setDialogOpen(false);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this invoice template?")) return;
    const { error } = await supabase.from("invoice_templates" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-xs text-muted-foreground sm:flex-1">
          Optional. Design invoice documents with placeholders like{" "}
          <code>{`{{line_items_table}}`}</code>, <code>{`{{total}}`}</code>,{" "}
          <code>{`{{client_name}}`}</code>. Filled in when you generate an invoice from a deal.
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[180px]">
          <Button size="sm" variant="outline" className="w-full justify-center" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> Upload document
          </Button>
          <Button size="sm" className="w-full justify-center" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> New template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No invoice templates yet.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{t.name}</span>
                {t.is_default && <Badge variant="secondary" className="text-[10px]">default</Badge>}
              </div>
              <div
                className="truncate text-xs text-muted-foreground"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(ensureHtml(t.body), { ALLOWED_TAGS: [] }).slice(0, 120),
                }}
              />
              <div className="flex flex-wrap items-center justify-end gap-1">
                <Button variant="ghost" size="sm" className="h-8" onClick={() => openEdit(t)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => openDuplicate(t)}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => remove(t.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit invoice template" : "New invoice template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Standard invoice"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Default
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <RichTextEditor value={body} onChange={setBody} minHeight={360} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContractUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onImport={openFromUpload} />
    </div>
  );
}
