import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCompanyCurrency(fallback = "USD") {
  const [currency, setCurrency] = useState(fallback);
  useEffect(() => {
    supabase
      .from("companies")
      .select("currency")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.currency) setCurrency(data.currency);
      });
  }, []);
  return currency;
}
