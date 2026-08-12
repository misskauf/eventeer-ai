import i18n from "@/i18n";

export type ApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "changes_requested";

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  not_required: "No approval needed",
  pending: "Awaiting approval",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const APPROVAL_TONES: Record<ApprovalStatus, string> = {
  not_required: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  changes_requested: "bg-red-100 text-red-800 border-red-200",
};

export function approvalLabel(s: string): string {
  return i18n.t(`approval.${s}`, {
    defaultValue: APPROVAL_LABELS[s as ApprovalStatus] ?? s,
  }) as string;
}
export function approvalToneClass(s: string): string {
  return APPROVAL_TONES[(s as ApprovalStatus)] ?? APPROVAL_TONES.not_required;
}
