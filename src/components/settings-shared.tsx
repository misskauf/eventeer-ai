import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field(props: any) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input {...props} id={props.name} />
    </div>
  );
}

/** Loads the current user's company (and optionally fee_config) for settings pages. */
export function useCompanySettings(withFees = false) {
  const [company, setCompany] = useState<any>(null);
  const [fees, setFees] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return setLoading(false);
    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();
    if (!role?.company_id) return setLoading(false);
    const { data: c } = await supabase
      .from("companies")
      .select("*")
      .eq("id", role.company_id)
      .maybeSingle();
    setCompany(c);
    if (c && withFees) {
      const { data: f } = await supabase.from("fee_config").select("*").eq("company_id", c.id).maybeSingle();
      setFees(f);
    }
    setLoading(false);
  }, [withFees]);

  useEffect(() => {
    load();
  }, [load]);

  return { company, setCompany, fees, loading, reload: load };
}
