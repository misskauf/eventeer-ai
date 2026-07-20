import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCompanyCurrency(fallback = "USD") {
  const [currency, setCurrency] = useState(fallback);
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: role } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();
      if (!role?.company_id) return;
      const { data } = await supabase
        .from("companies")
        .select("currency")
        .eq("id", role.company_id)
        .maybeSingle();
      if (data?.currency) setCurrency(data.currency);
    })();
  }, []);
  return currency;
}
