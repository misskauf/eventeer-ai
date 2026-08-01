import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ContractDocument } from "@/components/contract-document";
import { buildBriefHtml, type BriefExtras } from "@/lib/event-brief";
import type { ContractContext } from "@/lib/contracts";
import { Download, Mail, RefreshCw, Save } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listBriefRecipients, sendBriefToManager } from "@/lib/event-brief.functions";

type CompanyBrand = {
  name: string | null;
  logo_url: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export function EventBriefPanel({
  companyId,
  dealId,
  ctx,
  briefExtras,
  packageIds,
}: {
  companyId: string;
  dealId: string;
  ctx: ContractContext;
  briefExtras?: BriefExtras;
  /** Selected package ids — used to pull allergen notes for the F&B section. */
  packageIds?: string[];
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyBrand | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState("write");
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState<
    { user_id: string; role: string; email: string }[]
  >([]);
  const [pickedEmail, setPickedEmail] = useState<string>("");
  const [customEmail, setCustomEmail] = useState("");
  const [note, setNote] = useState("");

  const generate = useCallback(async () => {
    let allergenNotes: string[] = [];
    if (packageIds && packageIds.length) {
      const { data } = await supabase
        .from("fb_packages")
        .select("name, allergen_notes")
        .in("id", packageIds);
      allergenNotes = (data ?? [])
        .filter((p: any) => p.allergen_notes)
        .map((p: any) => `${p.name}: ${p.allergen_notes}`);
    }
    return buildBriefHtml(ctx, { ...(briefExtras ?? {}), allergenNotes });
  }, [ctx, briefExtras, packageIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [briefRes, companyRes] = await Promise.all([
        supabase.from("event_briefs").select("*").eq("deal_id", dealId).maybeSingle(),
        supabase
          .from("companies")
          .select("name, logo_url, address, contact_email, contact_phone")
          .eq("id", companyId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setCompany((companyRes.data as CompanyBrand) ?? null);
      if (briefRes.data) {
        setRowId(briefRes.data.id);
        setBody(briefRes.data.body ?? "");
      } else {
        setBody(await generate());
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, companyId]);

  async function save(nextBody?: string, generated = false) {
    const value = nextBody ?? body;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = generated
      ? { body: value, generated_at: new Date().toISOString() }
      : { body: value };
    let error;
    if (rowId) {
      ({ error } = await supabase.from("event_briefs").update(payload).eq("id", rowId));
    } else {
      const res = await supabase
        .from("event_briefs")
        .insert({
          company_id: companyId,
          deal_id: dealId,
          body: value,
          generated_at: new Date().toISOString(),
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .maybeSingle();
      error = res.error;
      if (res.data) setRowId(res.data.id);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    setDirty(false);
    toast.success("Brief saved");
  }

  async function regenerate() {
    const next = await generate();
    setBody(next);
    setDirty(true);
    setConfirmOpen(false);
    toast.info("Brief rebuilt from the current deal — review and save.");
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading brief…</div>;

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .brief-printable, .brief-printable * { visibility: visible !important; }
          .brief-printable { position: absolute; inset: 0; padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <h2 className="text-lg font-semibold">Event brief</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
            <RefreshCw className="mr-1 h-4 w-4" /> Regenerate from deal
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="mr-1 h-4 w-4" /> Download PDF
          </Button>
          <Button size="sm" disabled={saving || !dirty} onClick={() => save()}>
            <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-print">
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="no-print">
          <RichTextEditor
            value={body}
            onChange={(html) => {
              setBody(html);
              setDirty(true);
            }}
            placeholder="Event brief…"
            minHeight={480}
          />
        </TabsContent>
        <TabsContent value="preview">
          <Card className="brief-printable">
            <CardHeader className="no-print">
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-6 border-b pb-4">
                <div>
                  <div className="text-lg font-semibold">{company?.name ?? ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {[company?.address, company?.contact_email, company?.contact_phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    Event brief — {(ctx.deal as any)?.client_name ?? ""}
                  </div>
                </div>
                {company?.logo_url && (
                  <img
                    src={company.logo_url}
                    alt={`${company.name ?? "Venue"} logo`}
                    className="max-h-16"
                  />
                )}
              </div>
              <ContractDocument html={body} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebuild the brief?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the whole brief with freshly generated sections from the current
              deal. Any edits — including team notes — will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={regenerate}>Regenerate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
