// Shared (client-safe) types & helpers for per-document client follow-ups.

export const FOLLOWUP_DOC_TYPES = ["proposal", "contract"] as const;
export type FollowupDocType = (typeof FOLLOWUP_DOC_TYPES)[number];

export type FollowupMode = "auto" | "notify";
export type FollowupChannel = "in_app" | "email" | "both";

export type FollowupConfig = {
  doc_type: FollowupDocType;
  enabled: boolean;
  mode: FollowupMode;
  channel: FollowupChannel;
  interval_days: number;
  max_reminders: number | null;
};

export const DEFAULT_FOLLOWUP: Record<FollowupDocType, FollowupConfig> = {
  proposal: {
    doc_type: "proposal",
    enabled: true,
    mode: "notify",
    channel: "in_app",
    interval_days: 5,
    max_reminders: null,
  },
  contract: {
    doc_type: "contract",
    enabled: true,
    mode: "notify",
    channel: "in_app",
    interval_days: 7,
    max_reminders: null,
  },
};

/** Activity kind recorded each time a follow-up fires. */
export function followupActivityKind(doc: FollowupDocType): string {
  return `${doc}_followup_sent`;
}

/** Legacy activity kinds that should also count as a follow-up for a doc type. */
export function legacyFollowupKinds(doc: FollowupDocType): string[] {
  return doc === "proposal" ? ["proposal_reminder_sent"] : [];
}
