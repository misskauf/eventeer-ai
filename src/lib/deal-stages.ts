export type DealStage =
  | "new"
  | "contacted"
  | "meeting_scheduled"
  | "proposal_sent"
  | "client_approved"
  | "signed"
  | "waiting_payment"
  | "invoice_sent"
  | "downpayment_received"
  | "paid_in_full"
  | "payment_delayed"
  | "lost"
  // legacy values kept for backwards compatibility
  | "inquiry"
  | "proposal_draft"
  | "client_selected"
  | "manager_review"
  | "accepted";


export const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  meeting_scheduled: "Meeting scheduled",
  proposal_sent: "Proposal sent",
  client_approved: "Client approved",

  signed: "Signed",
  waiting_payment: "Waiting payment",
  invoice_sent: "Invoice sent",
  downpayment_received: "Downpayment received",
  paid_in_full: "Paid in full",
  payment_delayed: "Payment delayed",
  lost: "Lost",
  // legacy
  inquiry: "New",
  proposal_draft: "Proposal draft",
  client_selected: "Client selected",
  manager_review: "In review",
  accepted: "Signed",
};

// Ordered pipeline used for filter chips and the stage dropdown.
export const STAGE_ORDER: DealStage[] = [
  "new",
  "contacted",
  "meeting_scheduled",
  "proposal_sent",
  "client_approved",

  "signed",
  "waiting_payment",
  "invoice_sent",
  "downpayment_received",
  "paid_in_full",
  "payment_delayed",
  "lost",
];

type BadgeTone = {
  className: string;
};

// Tailwind classes intentionally kept literal so JIT picks them up.
export const STAGE_TONES: Record<string, BadgeTone> = {
  new: { className: "bg-slate-100 text-slate-700 border-slate-200" },
  contacted: { className: "bg-slate-100 text-slate-700 border-slate-200" },
  meeting_scheduled: { className: "bg-slate-100 text-slate-700 border-slate-200" },
  proposal_sent: { className: "bg-blue-100 text-blue-800 border-blue-200" },
  signed: { className: "bg-amber-100 text-amber-800 border-amber-200" },
  waiting_payment: { className: "bg-amber-100 text-amber-800 border-amber-200" },
  invoice_sent: { className: "bg-amber-100 text-amber-800 border-amber-200" },
  downpayment_received: { className: "bg-amber-100 text-amber-800 border-amber-200" },
  paid_in_full: { className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  payment_delayed: { className: "bg-red-100 text-red-800 border-red-200" },
  lost: { className: "bg-muted text-muted-foreground border-border line-through" },
  // legacy fallbacks
  inquiry: { className: "bg-slate-100 text-slate-700 border-slate-200" },
  proposal_draft: { className: "bg-slate-100 text-slate-700 border-slate-200" },
  client_selected: { className: "bg-blue-100 text-blue-800 border-blue-200" },
  manager_review: { className: "bg-blue-100 text-blue-800 border-blue-200" },
  accepted: { className: "bg-amber-100 text-amber-800 border-amber-200" },
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function stageToneClass(stage: string): string {
  return STAGE_TONES[stage]?.className ?? "bg-muted text-muted-foreground border-border";
}

// Calendar-specific tones, per user spec. Kept separate from STAGE_TONES so the
// table chips don't change.
export const STAGE_CALENDAR_TONES: Record<string, string> = {
  new: "bg-white text-slate-800 border-slate-300",
  contacted: "bg-slate-200 text-slate-800 border-slate-300",
  meeting_scheduled: "bg-slate-600 text-white border-slate-700",
  proposal_sent: "bg-blue-500 text-white border-blue-600",
  signed: "bg-yellow-300 text-yellow-900 border-yellow-400",
  waiting_payment: "bg-orange-400 text-white border-orange-500",
  invoice_sent: "bg-orange-400 text-white border-orange-500",
  downpayment_received: "bg-green-200 text-green-900 border-green-300",
  paid_in_full: "bg-green-600 text-white border-green-700",
  payment_delayed: "bg-red-100 text-red-800 border-red-300",
  lost: "bg-red-600 text-white border-red-700 line-through",
  // legacy fallbacks
  inquiry: "bg-white text-slate-800 border-slate-300",
  proposal_draft: "bg-slate-200 text-slate-800 border-slate-300",
  client_selected: "bg-blue-500 text-white border-blue-600",
  manager_review: "bg-blue-500 text-white border-blue-600",
  accepted: "bg-yellow-300 text-yellow-900 border-yellow-400",
};

export function stageCalendarToneClass(stage: string): string {
  return STAGE_CALENDAR_TONES[stage] ?? "bg-muted text-foreground border-border";
}

// Stages that indicate a booked/committed event — hard conflicts.
export const HARD_CONFLICT_STAGES: DealStage[] = [
  "signed",
  "waiting_payment",
  "invoice_sent",
  "downpayment_received",
  "paid_in_full",
  "payment_delayed",
];

// Stages that indicate an in-negotiation deal — soft warning.
export const SOFT_CONFLICT_STAGES: DealStage[] = [
  "new",
  "contacted",
  "meeting_scheduled",
  "proposal_sent",
  // legacy
  "inquiry",
  "proposal_draft",
  "client_selected",
  "manager_review",
];


export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
