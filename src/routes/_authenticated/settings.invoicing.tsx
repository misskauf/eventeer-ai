import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InvoiceTemplatesEditor } from "@/components/invoice-templates-panel";
import { useCompanySettings } from "@/components/settings-shared";

export const Route = createFileRoute("/_authenticated/settings/invoicing")({
  component: InvoicingSettings,
});

function InvoicingSettings() {
  const { company, loading, reload } = useCompanySettings();
  const [mode, setMode] = useState<string | null>(null);
  const currentMode = mode ?? (company as any)?.invoice_mode ?? "external";

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("companies")
      .update({
        invoice_mode: (fd.get("invoice_mode") as string) || "external",
        invoice_notes: (fd.get("invoice_notes") as string) || null,
      } as any)
      .eq("id", company.id);
    if (error) return toast.error(error.message);
    toast.success("Invoicing saved");
    reload();
  }

  if (loading || !company) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invoicing (optional)</CardTitle>
          <p className="text-sm text-muted-foreground">Choose how invoices are handled after a deal is signed.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={save}>
            <div className="grid gap-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="invoice_mode"
                  value="external"
                  checked={currentMode !== "template"}
                  onChange={() => setMode("external")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">External</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Invoice from your own tool. EventFlow only tracks the status.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="invoice_mode"
                  value="template"
                  checked={currentMode === "template"}
                  onChange={() => setMode("template")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">EventFlow template</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Generate an invoice document from the accepted proposal. Print to PDF from your browser.
                  </span>
                </span>
              </label>
            </div>
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-medium">Default invoice notes (optional)</label>
              <textarea
                name="invoice_notes"
                defaultValue={(company as any).invoice_notes ?? ""}
                rows={2}
                placeholder="Payment terms, bank details, thank-you note…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button className="w-full">Save invoicing</Button>
          </form>
        </CardContent>
      </Card>

      {currentMode === "template" && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice templates</CardTitle>
            <p className="text-sm text-muted-foreground">Used when generating invoices from a signed deal.</p>
          </CardHeader>
          <CardContent>
            <InvoiceTemplatesEditor companyId={company.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
