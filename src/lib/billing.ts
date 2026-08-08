/** Free trial length in days — change here only. */
export const TRIAL_DAYS = 60;

/** Address shown on the paywall screen. */
export const BILLING_CONTACT_EMAIL = "billing@eventflow.app";

export type SubscriptionStatus = "trialing" | "active" | "expired" | "comped";

export type BillingCompany = {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
};

export type TrialState = {
  status: SubscriptionStatus;
  /** True when the app should be locked behind the paywall. */
  locked: boolean;
  /** True while an unexpired trial is running. */
  isTrialing: boolean;
  /** Whole days remaining in the trial (0 when not trialing). */
  daysLeft: number;
};

export function getTrialState(company: BillingCompany | null | undefined): TrialState {
  const status = ((company?.subscription_status as SubscriptionStatus) ?? "active") satisfies
    | SubscriptionStatus
    | string as SubscriptionStatus;

  if (status === "active" || status === "comped") {
    return { status, locked: false, isTrialing: false, daysLeft: 0 };
  }
  if (status === "expired") {
    return { status, locked: true, isTrialing: false, daysLeft: 0 };
  }

  // trialing
  const endsAt = company?.trial_ends_at ? new Date(company.trial_ends_at).getTime() : null;
  if (!endsAt) return { status, locked: false, isTrialing: true, daysLeft: TRIAL_DAYS };
  const msLeft = endsAt - Date.now();
  if (msLeft <= 0) return { status, locked: true, isTrialing: false, daysLeft: 0 };
  return {
    status,
    locked: false,
    isTrialing: true,
    daysLeft: Math.max(1, Math.ceil(msLeft / 86_400_000)),
  };
}
