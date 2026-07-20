import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Trash2,
  Eye,
  Send,
  Link2,
  CheckCircle2,
  Ban,
  RefreshCw,
  Copy,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  renderContract,
  ensureHtml,
  type ContractContext,
} from "@/lib/contracts";
import {
  sendContractToClient,
  markContractSignedManually,
  voidContract,
} from "@/lib/contracts.functions";
import { formatRelative } from "@/lib/deal-stages";
import { RichTextEditor } from "@/components/rich-text-editor";
import DOMPurify from "isomorphic-dompurify";

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
  status: "draft" | "sent" | "signed" | "voided" | string;
  sent_at: string | null;
  sent_to_email: string | null;
  signing_token: string | null;
  signing_token_expires_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_email: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  companyId: string;
  ctx: ContractContext;
};

const STATUS_VARIANTS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  signed: { label: "Signed", className: "bg-green-500/15 text-green-700 dark:text-green-300" },
  voided: { label: "Voided", className: "bg-destructive/15 text-destructive" },
};

function signingUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/c/${token}`;
}

export function ContractsPanel({ companyId, ctx }: Props) {
  const sendFn = useServerFn(sendContractToClient);
  const markSignedFn = useServerFn(markContractSignedManually);
  const voidFn = useServerFn(voidContract);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedTplId, setSelectedTplId] = useState<string>("");
  const [editedBody, setEditedBody] = useState<string>("");
  const [viewer, setViewer] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(false);

  // Send dialog state
  const [sendTarget, setSendTarget] = useState<Contract | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendBusy, setSendBusy] = useState(false);

  // Manual sign dialog state
  const [manualTarget, setManualTarget] = useState<Contract | null>(null);
  const [manualName, setManualName] = useState("");

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
        .select(
          "id, template_id, template_name, rendered_body, status, sent_at, sent_to_email, signing_token, signing_token_expires_at, signed_at, signed_by_name, signed_by_email, created_at, updated_at",
        )
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
    setEditedBody(renderContract(ensureHtml(def.body), ctx));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const tpl = templates.find((t) => t.id === selectedTplId);
    if (tpl) setEditedBody(renderContract(ensureHtml(tpl.body), ctx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTplId]);

  async function saveDraft() {
    if (!ctx.deal?.id || !selectedTpl) return;
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("contracts" as any).insert({
      company_id: companyId,
      deal_id: ctx.deal.id,
      template_id: selectedTpl.id,
      template_name: selectedTpl.name,
      rendered_body: editedBody,
      status: "draft",
      created_by: userData.user?.id ?? null,
    } as any);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Draft saved");
    setOpen(false);
    refresh();
  }

  async function deleteContract(id: string) {
    if (!confirm("Delete this contract?")) return;
    const { error } = await supabase.from("contracts" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  function openSend(c: Contract) {
    setSendTarget(c);
    setSendEmail(c.sent_to_email ?? ctx.deal?.client_email ?? "");
  }

  async function doSend() {
    if (!sendTarget) return;
    setSendBusy(true);
    try {
      const r: any = await sendFn({
        data: { contract_id: sendTarget.id, to_email: sendEmail.trim(), expires_in_days: 30 },
      });
      const url = signingUrl(r.token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Signing link copied to clipboard", {
          description: "Email delivery isn't set up yet — send this link to the client.",
        });
      } catch {
        toast.success("Signing link ready", { description: url });
      }
      setSendTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally {
      setSendBusy(false);
    }
  }

  async function copyLink(c: Contract) {
    if (!c.signing_token) return;
    try {
      await navigator.clipboard.writeText(signingUrl(c.signing_token));
      toast.success("Signing link copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function doMarkSigned() {
    if (!manualTarget || !manualName.trim()) return;
    try {
      await markSignedFn({
        data: { contract_id: manualTarget.id, signed_by_name: manualName.trim() },
      });
      toast.success("Contract marked as signed");
      setManualTarget(null);
      setManualName("");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function doVoid(c: Contract) {
    if (!confirm("Void this contract? It stays in the history but can no longer be signed.")) return;
    try {
      await voidFn({ data: { contract_id: c.id } });
      toast.success("Contract voided");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
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
          {contracts.map((c) => {
            const s = STATUS_VARIANTS[c.status] ?? {
              label: c.status,
              className: "bg-muted text-muted-foreground",
            };
            return (
              <div
                key={c.id}
                className="space-y-1 rounded-md border bg-background px-2 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.template_name || "Contract"}</div>
                    <div className="text-muted-foreground">
                      {c.status === "signed" && c.signed_at
                        ? `Signed by ${c.signed_by_name ?? "client"} · ${formatRelative(c.signed_at)}`
                        : c.status === "sent" && c.sent_at
                          ? `Sent to ${c.sent_to_email ?? "client"} · ${formatRelative(c.sent_at)}`
                          : formatRelative(c.updated_at)}
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${s.className}`}>{s.label}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewer(c)}
                    title="View"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.status === "draft" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => openSend(c)}
                      >
                        <Send className="mr-1 h-3 w-3" /> Send to client
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-destructive"
                        onClick={() => deleteContract(c.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </>
                  )}
                  {c.status === "sent" && (
                    <>
                      {c.signing_token && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => copyLink(c)}
                        >
                          <Link2 className="mr-1 h-3 w-3" /> Copy link
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => openSend(c)}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" /> Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setManualTarget(c);
                          setManualName(ctx.deal?.client_name ?? "");
                        }}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Mark signed
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-destructive"
                        onClick={() => doVoid(c)}
                      >
                        <Ban className="mr-1 h-3 w-3" /> Void
                      </Button>
                    </>
                  )}
                  {c.status === "signed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive"
                      onClick={() => doVoid(c)}
                    >
                      <Ban className="mr-1 h-3 w-3" /> Void
                    </Button>
                  )}
                  {c.status === "voided" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive"
                      onClick={() => deleteContract(c.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
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
              <RichTextEditor
                value={editedBody}
                onChange={setEditedBody}
                minHeight={360}
              />
              <p className="text-xs text-muted-foreground">
                Placeholders were filled from the deal. You can still format and edit before saving.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveDraft} disabled={loading}>
                Save draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sendTarget} onOpenChange={(o) => !o && setSendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send contract to client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Client email</Label>
              <Input
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="client@example.com"
              />
              <p className="text-xs text-muted-foreground">
                We'll generate a secure signing link (valid 30 days). Email delivery isn't set up
                yet, so the link will be copied to your clipboard for you to send.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSendTarget(null)}>
                Cancel
              </Button>
              <Button onClick={doSend} disabled={sendBusy || !sendEmail.trim()}>
                {sendBusy ? "Generating…" : "Generate signing link"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manualTarget} onOpenChange={(o) => !o && setManualTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark contract signed</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Signer name</Label>
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Full name of the signer"
              />
              <p className="text-xs text-muted-foreground">
                Use this when the contract was signed offline (e.g. countersigned PDF returned by
                email).
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManualTarget(null)}>
                Cancel
              </Button>
              <Button onClick={doMarkSigned} disabled={!manualName.trim()}>
                Mark signed
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
          {viewer?.status === "signed" && (
            <div className="rounded-md border border-green-600/40 bg-green-50 p-2 text-xs dark:bg-green-950/20">
              Signed by <strong>{viewer.signed_by_name ?? "client"}</strong>
              {viewer.signed_at && <> on {new Date(viewer.signed_at).toLocaleString()}</>}
              {viewer.signed_by_email && <> · {viewer.signed_by_email}</>}
            </div>
          )}
          <div
            className="prose prose-sm max-w-none rounded-md border bg-background p-4 dark:prose-invert"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(ensureHtml(viewer?.rendered_body ?? "")),
            }}
          />
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
    setBody("");
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
                <div
                  className="truncate text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(ensureHtml(t.body), { ALLOWED_TAGS: [] }).slice(
                      0,
                      120,
                    ),
                  }}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDuplicate(t)}
                title="Duplicate"
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
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
              <RichTextEditor value={body} onChange={setBody} minHeight={360} />
              <p className="text-xs text-muted-foreground">
                Use the toolbar to add headings, bold, lists, dividers and images. Insert deal /
                company placeholders from the toolbar dropdown — they're filled in automatically
                when a contract is created.
              </p>
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

