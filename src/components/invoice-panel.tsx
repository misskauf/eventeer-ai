import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Receipt, Send, CheckCircle2, FileText, Printer, RefreshCw, Trash2 } from "lucide-react";
import { ContractDocument } from "@/components/contract-document";
import { renderInvoice, DEFAULT_INVOICE_TEMPLATE, type InvoiceContext } from "@/lib/invoices";
import { updateInvoiceStatus } from "@/lib/invoices.functions";
import { formatRelative } from "@/lib/deal-stages";

type Template = { id: string; name: string; body: string; is_default: boolean };
type Invoice = {
  id: string;
  template_id: string | null;
  template_name: string | null;
  body_html: string;
  mode: "external" | "template" | string;
  status: "draft" | "sent" | "done" | string;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  companyId: string;
  dealId: string;
  invoiceMode: "external" | "template";
  invoiceNotes?: string | null;
  ctx: InvoiceContext;
  visible: boolean;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  done: { label: "Done", className: "bg-green-500/15 text-green-700 dark:text-green-300" },
};

export function InvoicePanel({ companyId, dealId, invoiceMode, invoiceNotes, ctx, visible }: Props) {
  const updateStatusFn = useServerFn(updateInvoiceStatus);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedTplId, setSelectedTplId] = useState("");
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [tplRes, invRes] = await Promise.all([
      supabase
        .from("invoice_templates" as any)
        .select("id, name, body, is_default")
        .eq("company_id", companyId)
        .order("is_default", { ascending: false })
        .order("name"),
      supabase
        .from("invoices" as any)
        .select("id, template_id, template_name, body_html, mode, status, issued_at, created_at, updated_at")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false }),
    ]);
    setTemplates(((tplRes.data as any) ?? []) as Template[]);
    setInvoices(((invRes.data as any) ?? []) as Invoice[]);
  }

  useEffect(() => {
    if (visible && companyId && dealId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, companyId, dealId]);

  const withNotes: InvoiceContext = useMemo(
    () => ({ ...ctx, invoice_notes: invoiceNotes ?? ctx.invoice_notes ?? null }),
    [ctx, invoiceNotes],
  );

  function openGenerate() {
    if (templates.length === 0) {
      toast.error("No invoice templates yet. Add one in Settings → Invoicing.");
      return;
    }
    const def = templates.find((t) => t.is_default) ?? templates[0];
    setSelectedTplId(def.id);
    setGenerateOpen(true);
  }

  async function generate() {
    const tpl = templates.find((t) => t.id === selectedTplId);
    if (!tpl) return;
    setBusy(true);
    const rendered = renderInvoice(tpl.body || DEFAULT_INVOICE_TEMPLATE, withNotes);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("invoices" as any)
      .insert({
        company_id: companyId,
        deal_id: dealId,
        template_id: tpl.id,
        template_name: tpl.name,
        body_html: rendered,
        mode: "template",
        status: "draft",
        quote_number: withNotes.quote_number ?? null,
        created_by: userData.user?.id ?? null,
      } as any)
      .select("id, template_id, template_name, body_html, mode, status, issued_at, created_at, updated_at")
      .maybeSingle();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice generated");
    setGenerateOpen(false);
    setPreview((data as any) ?? null);
    refresh();
  }

  async function regenerate(inv: Invoice) {
    const tpl = templates.find((t) => t.id === inv.template_id) ?? templates.find((t) => t.is_default);
    if (!tpl) return toast.error("Template no longer exists");
    const rendered = renderInvoice(tpl.body || DEFAULT_INVOICE_TEMPLATE, withNotes);
    const { error } = await supabase
      .from("invoices" as any)
      .update({
        body_html: rendered,
        template_name: tpl.name,
        template_id: tpl.id,
        quote_number: withNotes.quote_number ?? null,
      } as any)
      .eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("Invoice regenerated from latest data");
    refresh();
  }

  async function markExternalSent() {
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("invoices" as any)
      .insert({
        company_id: companyId,
        deal_id: dealId,
        template_id: null,
        template_name: "External invoice",
        body_html: "",
        mode: "external",
        status: "sent",
        issued_at: new Date().toISOString(),
        created_by: userData.user?.id ?? null,
      } as any)
      .select("id")
      .maybeSingle();
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    try {
      await updateStatusFn({ data: { invoice_id: (data as any).id, status: "sent" } });
      toast.success("Marked as invoice sent");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
    setBusy(false);
    refresh();
  }

  async function setStatus(inv: Invoice, status: "sent" | "done") {
    try {
      await updateStatusFn({ data: { invoice_id: inv.id, status } });
      toast.success(status === "sent" ? "Marked as sent" : "Marked as done");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function remove(inv: Invoice) {
    if (!confirm("Delete this invoice record? The document will be removed.")) return;
    const { error } = await supabase.from("invoices" as any).delete().eq("id", inv.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  function print() {
    window.print();
  }

  if (!visible) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Receipt className="h-4 w-4" />
          Invoice
          <Badge variant="outline" className="text-[10px] font-normal">Optional</Badge>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          {invoiceMode === "external" ? (
            <Button size="sm" onClick={markExternalSent} disabled={busy}>
              <Send className="mr-1 h-3.5 w-3.5" /> Mark invoice sent
            </Button>
          ) : (
            <Button size="sm" onClick={openGenerate} disabled={busy}>
              <FileText className="mr-1 h-3.5 w-3.5" /> Generate invoice
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {invoiceMode === "external"
          ? "External mode — invoice the client in your own tool. EventFlow just tracks the status here."
          : "Template mode — generate an invoice document from the accepted proposal, then print to PDF from your browser."}
      </p>

      {invoices.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No invoices yet.
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const meta = STATUS_META[inv.status] ?? { label: inv.status, className: "bg-muted" };
            return (
              <div key={inv.id} className="rounded-md border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={meta.className}>{meta.label}</Badge>
                    <span className="font-medium">{inv.template_name ?? "Invoice"}</span>
                    <span className="text-xs text-muted-foreground">
                      {inv.mode === "external" ? "External" : "Template"} · created {formatRelative(inv.created_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 no-print">
                    {inv.mode === "template" && (
                      <>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setPreview(inv)}>
                          Preview
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => regenerate(inv)}>
                          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate
                        </Button>
                      </>
                    )}
                    {inv.status === "draft" && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus(inv, "sent")}>
                        <Send className="mr-1 h-3.5 w-3.5" /> Mark sent
                      </Button>
                    )}
                    {inv.status === "sent" && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus(inv, "done")}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark done
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => remove(inv)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={selectedTplId} onValueChange={setSelectedTplId}>
                <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
              <Button onClick={generate} disabled={busy || !selectedTplId}>Generate</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog with print button */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto printable-dialog">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center justify-between gap-4">
              <span>{preview?.template_name ?? "Invoice"}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={print}>
                  <Printer className="mr-1 h-3.5 w-3.5" /> Print / Save as PDF
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="printable">
            <ContractDocument html={preview?.body_html ?? ""} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
