/** Shared, client-safe payment-schedule vocabulary and math. */

export type PaymentStatus = "pending" | "sent" | "paid" | "overdue";
export type PaymentMethod = "bank" | "stripe" | "other";

export type PaymentRow = {
  id: string;
  company_id: string;
  deal_id: string;
  label: string;
  amount: number;
  due_date: string | null;
  status: PaymentStatus | string;
  method: PaymentMethod | string | null;
  paid_at: string | null;
  marked_by: string | null;
  sort: number;
  created_at?: string;
};

export type PaymentDraft = {
  label: string;
  amount: number;
  due_date: string | null;
};

export type PaymentTerms = "full" | "installments" | "after_event";

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  sent: "Requested",
  paid: "Paid",
  overdue: "Overdue",
};

export const STATUS_TONES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  paid: "bg-green-500/15 text-green-700 dark:text-green-300",
  overdue: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export const METHOD_LABELS: Record<string, string> = {
  bank: "Bank transfer",
  stripe: "Card / Stripe",
  other: "Other",
};

/** Installment presets. Percentages must sum to 100. */
export type InstallmentPreset = {
  id: string;
  label: string;
  parts: Array<{
    label: string;
    pct: number;
    /** Due anchor: on signing (today), N days before the event, or N days after. */
    anchor: "signing" | "before_event" | "after_event";
    days?: number;
  }>;
};

export const INSTALLMENT_PRESETS: InstallmentPreset[] = [
  {
    id: "50_50",
    label: "50% deposit on signing, 50% 14 days before event",
    parts: [
      { label: "Deposit", pct: 50, anchor: "signing" },
      { label: "Balance", pct: 50, anchor: "before_event", days: 14 },
    ],
  },
  {
    id: "30_70",
    label: "30% deposit on signing, 70% 7 days before event",
    parts: [
      { label: "Deposit", pct: 30, anchor: "signing" },
      { label: "Balance", pct: 70, anchor: "before_event", days: 7 },
    ],
  },
  {
    id: "thirds",
    label: "3 equal parts — signing, 30 days before, 7 days after",
    parts: [
      { label: "Deposit", pct: 34, anchor: "signing" },
      { label: "Second instalment", pct: 33, anchor: "before_event", days: 30 },
      { label: "Final instalment", pct: 33, anchor: "after_event", days: 7 },
    ],
  },
];

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build schedule rows from a preset, distributing rounding onto the last part. */
export function buildFromPreset(
  preset: InstallmentPreset,
  total: number,
  eventDate: string | null,
): PaymentDraft[] {
  const today = toISODate(new Date());
  const drafts = preset.parts.map((p) => {
    let due: string | null = today;
    if (p.anchor === "before_event") due = eventDate ? shiftDays(eventDate, -(p.days ?? 0)) : null;
    if (p.anchor === "after_event") due = eventDate ? shiftDays(eventDate, p.days ?? 0) : null;
    return { label: p.label, amount: round2((total * p.pct) / 100), due_date: due };
  });
  const diff = round2(total - drafts.reduce((s, d) => s + d.amount, 0));
  if (drafts.length > 0 && diff !== 0) {
    const last = drafts[drafts.length - 1]!;
    last.amount = round2(last.amount + diff);
  }
  return drafts;
}

export function sumDrafts(drafts: PaymentDraft[]): number {
  return round2(drafts.reduce((s, d) => s + (Number(d.amount) || 0), 0));
}

/** Total must match within one cent. */
export function scheduleMatchesTotal(drafts: PaymentDraft[], total: number): boolean {
  return Math.abs(sumDrafts(drafts) - round2(total)) < 0.01;
}

/** Status shown to the user: unpaid rows past their due date read as overdue. */
export function effectiveStatus(p: Pick<PaymentRow, "status" | "due_date">): PaymentStatus {
  const s = (p.status as PaymentStatus) ?? "pending";
  if (s === "paid") return "paid";
  if (p.due_date && new Date(`${p.due_date}T23:59:59`) < new Date()) return "overdue";
  return s;
}

export type PaymentSummary = {
  total: number;
  paid: number;
  outstanding: number;
  overdue: number;
};

export function summarize(rows: PaymentRow[]): PaymentSummary {
  let total = 0;
  let paid = 0;
  let overdue = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    total += amt;
    if (effectiveStatus(r) === "paid") paid += amt;
    else if (effectiveStatus(r) === "overdue") overdue += amt;
  }
  return {
    total: round2(total),
    paid: round2(paid),
    outstanding: round2(total - paid),
    overdue: round2(overdue),
  };
}

export type BankDetails = {
  bank_account_name?: string | null;
  bank_name?: string | null;
  bank_iban?: string | null;
  bank_bic?: string | null;
  payment_reference_note?: string | null;
};

export function hasBankDetails(b: BankDetails | null | undefined): boolean {
  return !!(b && (b.bank_iban || b.bank_name || b.bank_account_name));
}

/** Bilingual copy for client-facing payment communication. */
export const PAY_COPY = {
  en: {
    subject_due: "Payment due for your event",
    subject_overdue: "Overdue payment for your event",
    greeting: "Hi",
    due_line: "this is a friendly reminder that the following payment is due:",
    overdue_line: "our records show the following payment is overdue:",
    view_here: "You can view the full payment schedule and bank details here:",
    thanks: "Thank you!",
    page_title: "Payment schedule",
    amount: "Amount",
    due: "Due",
    status: "Status",
    bank_title: "Bank transfer details",
    account_name: "Account holder",
    bank: "Bank",
    reference: "Reference",
    paid: "Paid",
    outstanding: "Outstanding",
    pay_card: "Pay by card / SEPA",
    or_transfer: "Or pay by bank transfer:",
  },
  de: {
    subject_due: "Zahlung für Ihre Veranstaltung fällig",
    subject_overdue: "Überfällige Zahlung für Ihre Veranstaltung",
    greeting: "Hallo",
    due_line: "eine freundliche Erinnerung: die folgende Zahlung ist fällig:",
    overdue_line: "laut unseren Unterlagen ist die folgende Zahlung überfällig:",
    view_here: "Den vollständigen Zahlungsplan und die Bankdaten finden Sie hier:",
    thanks: "Vielen Dank!",
    page_title: "Zahlungsplan",
    amount: "Betrag",
    due: "Fällig",
    status: "Status",
    bank_title: "Bankverbindung",
    account_name: "Kontoinhaber",
    bank: "Bank",
    reference: "Verwendungszweck",
    paid: "Bezahlt",
    outstanding: "Offen",
    pay_card: "Mit Karte / SEPA zahlen",
    or_transfer: "Oder per Überweisung zahlen:",
  },
} as const;

export function payCopy(lang: string | null | undefined) {
  return lang === "de" ? PAY_COPY.de : PAY_COPY.en;
}
