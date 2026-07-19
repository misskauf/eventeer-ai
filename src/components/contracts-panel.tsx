import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Eye } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  renderContract,
  CONTRACT_PLACEHOLDERS,
  type ContractContext,
} from "@/lib/contracts";
import { formatRelative } from "@/lib/deal-stages";

type Template = {
  id: string;
  name: string;
  body: string;
  is_default: boolean;
};

type Contract = {
  id: string;
  template_id: string | null;
  template_name: string;
  rendered_body: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  companyId: string;
  ctx: ContractContext;
};

export function ContractsPanel({ companyId, ctx }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedTplId, setSelectedTplId] = useState<string>("");
  const [editedBody, setEditedBody] = useState<string>("");
  const [viewer, setViewer] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [tplRes, cRes] = await Promise.all([
      supabase
        .from("contract_templates" as any)
        .select("id, name, body, is_default")
        .eq("company_id", companyId)
        .order("is_default", { ascending: false })
        .order("name"),
      supabase
        .from("contracts" as any)
        .select("id, template_id, template_name, rendered_body, status, created_at, updated_at")
        .eq("deal_id", ctx.deal?.id)
        .order("created_at", { ascending: false }),
    ]);
    setTemplates(((tplRes.data as any) ?? []) as Template[]);
    setContracts(((cRes.data as any) ?? []) as Contract[]);
  }

  useEffect(() => {
    if (companyId && ctx.deal?.id) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, ctx.deal?.id]);

  const selectedTpl = useMemo(
    () => templates.find((t) => t.id === selectedTplId),
    [templates, selectedTplId],
  );

  function openDialog() {
    if (templates.length === 0) {
      toast.error("No contract templates yet. Add one in Settings.");
      return;
    }
    const def = templates.find((t) => t.is_default) ?? templates[0];
    setSelectedTplId(def.id);
    setEditedBody(renderContract(def.body, ctx));
    setOpen(true);
  }

  // Re-render when template changes
  useEffect(() => {
    if (!open) return;
    const tpl = templates.find((t) => t.id === selectedTplId);
    if (tpl) setEditedBody(renderContract(tpl.body, ctx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTplId]);

  async function saveContract(status: "draft" | "signed") {
    if (!ctx.deal?.id || !selectedTpl) return;
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("contracts" as any).insert({
      company_id: companyId,
      deal_id: ctx.deal.id,
      template_id: selectedTpl.id,
      template_name: selectedTpl.name,
      rendered_body: editedBody,
      status,
      created_by: userData.user?.id ?? null,
    } as any);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(status === "signed" ? "Contract saved and marked signed" : "Contract saved");
    setOpen(false);
    refresh();
  }

  async function deleteContract(id: string) {
    if (!confirm("Delete this contract?")) return;
    const { error } = await supabase.from("contracts" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="space-y-2">
      <Button onClick={openDialog} variant="outline" className="w-full">
        <FileText className="mr-1 h-4 w-4" /> Create contract
      </Button>

      {templates.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No templates yet.{" "}
          <Link to="/settings" className="underline">
            Add one in Settings
          </Link>
          .
        </p>
      )}

      {contracts.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Contracts
          </div>
          {contracts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.template_name || "Contract"}</div>
                <div className="text-muted-foreground">{formatRelative(c.updated_at)}</div>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {c.status}
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewer(c)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteContract(c.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create contract</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={selectedTplId} onValueChange={setSelectedTplId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.is_default && "(default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contract body</Label>
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={18}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Placeholders were filled from the deal. You can still edit before saving.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => saveContract("signed")}
                disabled={loading}
              >
                Save & mark signed
              </Button>
              <Button onClick={() => saveContract("draft")} disabled={loading}>
                Save draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewer?.template_name || "Contract"}</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
            {viewer?.rendered_body}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ContractTemplatesEditor({ companyId }: { companyId: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  async function refresh() {
    const { data } = await supabase
      .from("contract_templates" as any)
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
    setBody(SAMPLE_TEMPLATE);
    setIsDefault(templates.length === 0);
    setDialogOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setName(t.name);
    setBody(t.body);
    setIsDefault(t.is_default);
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) return toast.error("Name is required");
    // Clear other defaults if this one is default
    if (isDefault) {
      await supabase
        .from("contract_templates" as any)
        .update({ is_default: false } as any)
        .eq("company_id", companyId);
    }
    const payload = { name: name.trim(), body, is_default: isDefault };
    let error;
    if (editing) {
      ({ error } = await supabase
        .from("contract_templates" as any)
        .update(payload as any)
        .eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("contract_templates" as any)
        .insert({ ...payload, company_id: companyId } as any));
    }
    if (error) return toast.error(error.message);
    toast.success("Template saved");
    setDialogOpen(false);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("contract_templates" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Reusable contracts with placeholders. Insert deal details automatically when creating a
          contract.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No templates yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{t.name}</span>
                  {t.is_default && (
                    <Badge variant="secondary" className="text-[10px]">
                      default
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {t.body.slice(0, 100)}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => remove(t.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Standard event contract"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Default
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={18}
                className="font-mono text-xs"
              />
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-xs font-medium">Available placeholders</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {CONTRACT_PLACEHOLDERS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setBody((b) => b + `{{${p.key}}}`)}
                    className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted"
                    title={p.label}
                  >
                    {`{{${p.key}}}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SAMPLE_TEMPLATE = `EVENT CONTRACT

Between {{company_name}} and {{client_name}} ({{client_company}}, {{client_email}}).

Event date: {{event_date}}
Guests: {{guest_count}}
Duration: {{event_hours}} hours
Venue: {{venue}}

Food package: {{food_package}}
Drinks package: {{drinks_package}}

Menu selections:
{{menu_selections}}

Extras:
{{extras}}

Pricing
Subtotal: {{subtotal}}
Tax: {{tax}}
Total: {{total}}

Signed on {{today}}.

Client: ______________________
{{company_name}}: ______________________
`;
