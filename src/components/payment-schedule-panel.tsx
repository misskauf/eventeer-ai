import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, CreditCard, Link2, Mail, Plus, Trash2, Wand2 } from "lucide-react";
import {
  INSTALLMENT_PRESETS,
  buildFromPreset,
  effectiveStatus,
  round2,
  scheduleMatchesTotal,
  shiftDays,
  METHOD_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  sumDrafts,
  summarize,
  toISODate,
  type PaymentDraft,
  type PaymentRow,
  type PaymentTerms,
} from "@/lib/payments";
import {
  getPaymentShareLink,
  listPayments,
  markPaymentPaid,
  saveSchedule,
  sendPaymentReminder,
} from "@/lib/payments.functions";
import { usePermissions } from "@/lib/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { hasBankDetails as checkBank } from "@/lib/payments";

type Props = {
  dealId: string;
  companyId: string;
  eventDate: string | null;
  currency: string;
  /** Accepted proposal / quote grand total. */
  total: number;
};

function money(currency: string, n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function PaymentSchedulePanel({ dealId, companyId, eventDate, currency, total }: Props) {
  const { can, loading: permLoading } = usePermissions();
  const canView = can("payments", "view");
  const canEdit = can("payments", "edit");

  const list = useServerFn(listPayments);
  const save = useServerFn(saveSchedule);
  const markPaid = useServerFn(markPaymentPaid);
  const remind = useServerFn(sendPaymentReminder);
  const shareLink = useServerFn(getPaymentShareLink);

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState<PaymentTerms>("installments");
  const [presetId, setPresetId] = useState(INSTALLMENT_PRESETS[0]!.id);
  const [afterDays, setAfterDays] = useState(14);
  const [fullDue, setFullDue] = useState<string>(toISODate(new Date()));
  const [drafts, setDrafts] = useState<PaymentDraft[]>([]);
  const [bankOk, setBankOk] = useState(true);
  const [stripeOn, setStripeOn] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await list({ data: { dealId } });
      setRows((res as any).payments as PaymentRow[]);
    } catch (err: any) {
      // Silent when the user simply lacks access.
      if (!String(err?.message ?? "").includes("Forbidden")) console.warn(err);
    }
  }, [dealId, list]);

  useEffect(() => {
    if (canView) void refresh();
  }, [canView, refresh]);

  useEffect(() => {
    if (!canView) return;
    void supabase
      .from("companies")
      .select("bank_account_name, bank_name, bank_iban, bank_bic, payment_reference_note, stripe_enabled")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        setBankOk(checkBank(data as never));
        setStripeOn(Boolean((data as any)?.stripe_enabled));
      });
  }, [canView, companyId]);

  if (permLoading || !canView) return null;

  const summary = summarize(rows);

  function applyTemplate(next: PaymentTerms = terms) {
    if (next === "full") {
      setDrafts([{ label: "Full payment", amount: round2(total), due_date: fullDue }]);
      return;
    }
    if (next === "after_event") {
      setDrafts([
        {
          label: "Post-event invoice",
          amount: round2(total),
          due_date: eventDate ? shiftDays(eventDate, afterDays) : null,
        },
      ]);
      return;
    }
    const preset = INSTALLMENT_PRESETS.find((p) => p.id === presetId) ?? INSTALLMENT_PRESETS[0]!;
    setDrafts(buildFromPreset(preset, total, eventDate));
  }

  function startEditing() {
    setEditing(true);
    if (drafts.length === 0) applyTemplate();
  }

  async function persist() {
    if (drafts.length === 0) return toast.error("Add at least one payment.");
    if (!scheduleMatchesTotal(drafts, total))
      return toast.error(
        `Parts must sum to the quote total (${money(currency, total)}). Currently ${money(currency, sumDrafts(drafts))}.`,
      );
    setBusy(true);
    try {
      await save({ data: { dealId, terms, rows: drafts } });
      toast.success("Payment schedule saved");
      setEditing(false);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save the schedule");
    } finally {
      setBusy(false);
    }
  }

  async function onMarkPaid(id: string) {
    setBusy(true);
    try {
      const res: any = await markPaid({ data: { paymentId: id, method: "bank" } });
      toast.success(res?.allPaid ? "All payments received — deal marked paid in full" : "Payment marked as paid");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not mark as paid");
    } finally {
      setBusy(false);
    }
  }

  async function onRemind(id: string) {
    setBusy(true);
    try {
      await remind({ data: { paymentId: id } });
      toast.success("Reminder sent to the client");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send the reminder");
    } finally {
      setBusy(false);
    }
  }

  async function onCopyLink() {
    try {
      const res: any = await shareLink({ data: { dealId } });
      const url = `${window.location.origin}${res.path}`;
      await navigator.clipboard.writeText(url);
      toast.success("Payment page link copied");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create the link");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CreditCard className="h-4 w-4" /> Payment schedule
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onCopyLink} title="Client payment page">
              <Link2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={startEditing}>
              <Wand2 className="mr-1 h-4 w-4" /> {rows.length ? "Regenerate" : "Set terms"}
            </Button>
          </div>
        )}
      </div>

      {!bankOk && canEdit && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Add your bank/IBAN details in Settings → Invoicing so they appear on payment requests.
        </p>
      )}

      {rows.length > 0 && (
        <div className="rounded-md border text-sm">
          {rows.map((p) => {
            const st = effectiveStatus(p);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.due_date ? `Due ${p.due_date}` : "No due date"}
                    {p.paid_at ? ` · Paid ${new Date(p.paid_at).toLocaleDateString()}` : ""}
                    {p.paid_at && p.method ? ` · ${METHOD_LABELS[p.method] ?? p.method}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="whitespace-nowrap font-medium">{money(currency, Number(p.amount))}</span>
                  <Badge className={STATUS_TONES[st]} variant="secondary">
                    {STATUS_LABELS[st]}
                  </Badge>
                  {canEdit && st !== "paid" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => onRemind(p.id)} disabled={busy} title="Send reminder">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onMarkPaid(p.id)} disabled={busy} title="Mark paid">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex justify-between bg-muted/40 px-3 py-2 text-xs">
            <span>
              Paid <strong>{money(currency, summary.paid)}</strong> · Outstanding{" "}
              <strong>{money(currency, summary.outstanding)}</strong>
            </span>
            {summary.overdue > 0 && (
              <span className="text-red-600">Overdue {money(currency, summary.overdue)}</span>
            )}
          </div>
        </div>
      )}

      {stripeOn && rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Card &amp; SEPA payments are on — clients can pay each item from the payment page link.
        </p>
      )}

      {rows.length === 0 && !editing && (
        <p className="text-xs text-muted-foreground">No payment schedule yet.</p>
      )}

      {editing && canEdit && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Payment terms</Label>
            <Select
              value={terms}
              onValueChange={(v) => {
                setTerms(v as PaymentTerms);
                applyTemplate(v as PaymentTerms);
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Pay in full</SelectItem>
                <SelectItem value="installments">Installments</SelectItem>
                <SelectItem value="after_event">Invoice after event</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {terms === "full" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input
                type="date"
                className="h-8"
                value={fullDue}
                onChange={(e) => {
                  setFullDue(e.target.value);
                  setDrafts([{ label: "Full payment", amount: round2(total), due_date: e.target.value }]);
                }}
              />
            </div>
          )}

          {terms === "after_event" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Days after the event</Label>
              <Input
                type="number"
                min={0}
                className="h-8"
                value={afterDays}
                onChange={(e) => {
                  const n = Number(e.target.value) || 0;
                  setAfterDays(n);
                  setDrafts([
                    {
                      label: "Post-event invoice",
                      amount: round2(total),
                      due_date: eventDate ? shiftDays(eventDate, n) : null,
                    },
                  ]);
                }}
              />
              {!eventDate && <p className="text-xs text-muted-foreground">Set an event date to compute the due date.</p>}
            </div>
          )}

          {terms === "installments" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Preset</Label>
              <Select
                value={presetId}
                onValueChange={(v) => {
                  setPresetId(v);
                  const preset = INSTALLMENT_PRESETS.find((p) => p.id === v)!;
                  setDrafts(buildFromPreset(preset, total, eventDate));
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTALLMENT_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            {drafts.map((d, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_130px_32px] items-center gap-2">
                <Input
                  className="h-8"
                  value={d.label}
                  onChange={(e) =>
                    setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <Input
                  className="h-8"
                  type="number"
                  step="0.01"
                  value={d.amount}
                  onChange={(e) =>
                    setDrafts((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)),
                    )
                  }
                />
                <Input
                  className="h-8"
                  type="date"
                  value={d.due_date ?? ""}
                  onChange={(e) =>
                    setDrafts((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, due_date: e.target.value || null } : x)),
                    )
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setDrafts((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setDrafts((prev) => [
                  ...prev,
                  { label: "Instalment", amount: round2(Math.max(0, total - sumDrafts(prev))), due_date: null },
                ])
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add row
            </Button>
          </div>

          <div
            className={`text-xs ${scheduleMatchesTotal(drafts, total) ? "text-muted-foreground" : "text-red-600"}`}
          >
            Sum {money(currency, sumDrafts(drafts))} of quote total {money(currency, total)}
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={persist} disabled={busy}>
              Save schedule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
