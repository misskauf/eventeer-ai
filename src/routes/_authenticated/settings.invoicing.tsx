import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { InvoiceTemplatesEditor } from "@/components/invoice-templates-panel";
import { useCompanySettings } from "@/components/settings-shared";
import { usePermissions } from "@/lib/use-permissions";

export const Route = createFileRoute("/_authenticated/settings/invoicing")({
  component: InvoicingSettings,
});

/** Renders a quote-number pattern the same way the database function does. */
function formatQuoteNumber(opts: {
  format: string;
  venueCode: string;
  seq: number;
  padding: number;
}) {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const out = (opts.format || "{venue}-{YYYY}-{seq}")
    .replaceAll("{venue}", opts.venueCode || "")
    .replaceAll("{YYYY}", yyyy)
    .replaceAll("{YY}", yyyy.slice(2))
    .replaceAll("{MM}", String(now.getMonth() + 1).padStart(2, "0"))
    .replaceAll("{seq}", String(Math.max(opts.seq, 1)).padStart(Math.max(opts.padding, 1), "0"));
  return out.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}

function QuoteNumberingCard({ company, reload }: { company: any; reload: () => void }) {
  const { can } = usePermissions();
  const editable = can("settings", "admin");
  const [format, setFormat] = useState<string>(company.quote_format ?? "{venue}-{YYYY}-{seq}");
  const [venueCode, setVenueCode] = useState<string>(company.venue_code ?? "");
  const [padding, setPadding] = useState<number>(company.quote_seq_padding ?? 4);
  const [resetYearly, setResetYearly] = useState<boolean>(company.quote_reset_yearly ?? true);
  const [saving, setSaving] = useState(false);

  const nextSeq =
    resetYearly && company.quote_seq_year !== new Date().getFullYear()
      ? 1
      : (company.quote_next_seq ?? 1);
  const preview = formatQuoteNumber({ format, venueCode, seq: nextSeq, padding });

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({
        quote_format: format || "{venue}-{YYYY}-{seq}",
        venue_code: venueCode || null,
        quote_seq_padding: Math.min(Math.max(Number(padding) || 4, 1), 10),
        quote_reset_yearly: resetYearly,
      } as any)
      .eq("id", company.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Quote numbering saved");
    reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote numbering</CardTitle>
        <p className="text-sm text-muted-foreground">
          The serial number assigned to a proposal the first time it is sent. Revisions reuse it with a
          <span className="font-mono"> -v2</span> suffix.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quote_format">Format</Label>
            <Input
              id="quote_format"
              value={format}
              disabled={!editable}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="{venue}-{YYYY}-{seq}"
            />
            <p className="text-xs text-muted-foreground">
              Tokens: <span className="font-mono">{"{venue}"}</span>{" "}
              <span className="font-mono">{"{YYYY}"}</span> <span className="font-mono">{"{YY}"}</span>{" "}
              <span className="font-mono">{"{MM}"}</span> <span className="font-mono">{"{seq}"}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="venue_code">Venue code</Label>
            <Input
              id="venue_code"
              value={venueCode}
              disabled={!editable}
              onChange={(e) => setVenueCode(e.target.value)}
              placeholder="BB"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote_seq_padding">Number padding</Label>
            <Input
              id="quote_seq_padding"
              type="number"
              min={1}
              max={10}
              value={padding}
              disabled={!editable}
              onChange={(e) => setPadding(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Reset counter yearly</div>
              <div className="text-xs text-muted-foreground">Start again at 1 each January.</div>
            </div>
            <Switch checked={resetYearly} disabled={!editable} onCheckedChange={setResetYearly} />
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Next number: <span className="font-mono font-medium">{preview}</span>
        </div>

        {editable ? (
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save numbering"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Only admins can change quote numbering.</p>
        )}
      </CardContent>
    </Card>
  );
}

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
