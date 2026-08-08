import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTrialState, type BillingCompany, type TrialState } from "@/lib/billing";

/** Subscription / trial state for the signed-in user's company. */
export function useSubscription() {
  const [company, setCompany] = useState<BillingCompany | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        if (alive) setLoading(false);
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();
      if (!role?.company_id) {
        if (alive) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("companies")
        .select("subscription_status, trial_ends_at")
        .eq("id", role.company_id)
        .maybeSingle();
      if (!alive) return;
      setCompany((data as BillingCompany) ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const state: TrialState = getTrialState(company);
  return { ...state, loading };
}
