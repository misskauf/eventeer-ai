import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { CategoryDefaults, Category } from "@/lib/tax";
import { categoryDefault, categoryDefaultHours } from "@/lib/tax";

type Props = {
  companyId: string | null;
  category: Category;
  defaults: CategoryDefaults | null;
  onSaved: (next: CategoryDefaults) => void;
  showHours?: boolean;
  rightSlot?: React.ReactNode;
};

export function CategoryDefaultsBar({ companyId, category, defaults, onSaved, showHours, rightSlot }: Props) {
  const def = categoryDefault(defaults, category);
  const hours = categoryDefaultHours(defaults, category as any);
  const [editing, setEditing] = useState(false);
  const [basis, setBasis] = useState<"net" | "gross">(def.basis);
  const [rate, setRate] = useState<number>(def.rate);
  const [h, setH] = useState<number>(hours);
  const [saving, setSaving] = useState(false);

  function begin() {
    setBasis(def.basis);
    setRate(def.rate);
    setH(hours);
    setEditing(true);
  }

  async function save() {
    if (!companyId) return;
    setSaving(true);
    const patch: any = {
      [`default_basis_${category}`]: basis,
      [`tax_rate_${category}`]: rate,
    };
    if (showHours && (category === "food" || category === "beverage")) {
      patch[`default_hours_${category}`] = h;
    }
    const { data, error } = await supabase
      .from("fee_config")
      .update(patch)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Category default updated");
    setEditing(false);
    if (data) onSaved(data as any);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-4 py-2 text-sm">
      {!editing ? (
        <>
          <div>
            Category default: <b>{def.basis === "gross" ? "Gross" : "Net"}</b> · Tax <b>{def.rate}%</b>
            {showHours && <> · Standard <b>{hours}h</b></>}
            <button type="button" onClick={begin} className="ml-3 text-primary underline">
              Edit
            </button>
          </div>
          {rightSlot}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Basis</span>
          <select
            value={basis}
            onChange={(e) => setBasis(e.target.value as "net" | "gross")}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="net">Net</option>
            <option value="gross">Gross</option>
          </select>
          <span className="text-muted-foreground">Tax %</span>
          <Input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
            className="h-8 w-24"
          />
          {showHours && (
            <>
              <span className="text-muted-foreground">Standard hours</span>
              <Input
                type="number"
                step="0.5"
                value={h}
                onChange={(e) => setH(Number(e.target.value) || 0)}
                className="h-8 w-24"
              />
            </>
          )}
          <Button size="sm" onClick={save} disabled={saving}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
