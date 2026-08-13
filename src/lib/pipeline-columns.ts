import type { DealStage } from "@/lib/deal-stages";

export type PipelineColumn = {
  id: string;
  /** i18n key under deals.* */
  labelKey: string;
  fallbackLabel: string;
  stages: DealStage[];
  /** Stage applied when a card is dropped into this column. */
  primaryStage: DealStage;
};

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  {
    id: "new",
    labelKey: "deals.board_new",
    fallbackLabel: "New & contact",
    stages: ["new", "contacted", "meeting_scheduled", "inquiry"],
    primaryStage: "new",
  },
  {
    id: "proposal",
    labelKey: "deals.board_proposal",
    fallbackLabel: "Proposal sent",
    stages: ["proposal_sent", "proposal_draft", "client_selected", "manager_review"],
    primaryStage: "proposal_sent",
  },
  {
    id: "changes",
    labelKey: "deals.board_changes",
    fallbackLabel: "Changes requested",
    stages: ["changes_requested"],
    primaryStage: "changes_requested",
  },
  {
    id: "approved",
    labelKey: "deals.board_approved",
    fallbackLabel: "Client approved",
    stages: ["client_approved"],
    primaryStage: "client_approved",
  },
  {
    id: "signed",
    labelKey: "deals.board_signed",
    fallbackLabel: "Signed",
    stages: ["signed", "accepted"],
    primaryStage: "signed",
  },
  {
    id: "payment",
    labelKey: "deals.board_payment",
    fallbackLabel: "Payment",
    stages: [
      "waiting_payment",
      "invoice_sent",
      "downpayment_received",
      "paid_in_full",
      "payment_delayed",
    ],
    primaryStage: "waiting_payment",
  },
  {
    id: "lost",
    labelKey: "deals.board_lost",
    fallbackLabel: "Lost",
    stages: ["lost"],
    primaryStage: "lost",
  },
];

const STAGE_TO_COLUMN: Record<string, string> = Object.fromEntries(
  PIPELINE_COLUMNS.flatMap((c) => c.stages.map((s) => [s, c.id])),
);

/** Column id for a raw deal stage; unknown stages fall into the first column. */
export function columnForStage(stage: string): string {
  return STAGE_TO_COLUMN[stage] ?? PIPELINE_COLUMNS[0]!.id;
}

export function columnById(id: string): PipelineColumn | undefined {
  return PIPELINE_COLUMNS.find((c) => c.id === id);
}
