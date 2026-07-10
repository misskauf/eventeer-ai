import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "tags";
  options?: { value: string; label: string }[];
  suggestions?: string[]; // for type "tags"
  step?: string;
  defaultValue?: string | number;
  nullable?: boolean; // empty string -> null (for optional numbers/selects)
  hint?: string;
  rows?: number;
};

export function CrudList<T extends { id: string }>({
  table,
  companyId,
  fields,
  render,
  title,
  filter,
  staticValues,
  extraFormContent,
}: {
  table: string;
  companyId: string | null;
  fields: Field[];
  render: (row: T) => ReactNode;
  title: string;
  filter?: Record<string, any>; // eq() filters applied on load
  staticValues?: Record<string, any>; // merged into every insert/update payload
  extraFormContent?: (row: T | null) => ReactNode;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    let q = supabase.from(table as any).select("*").order("created_at", { ascending: false });
    for (const [k, v] of Object.entries(filter ?? {})) q = q.eq(k, v);
    const { data } = await q;
    setRows((data as unknown as T[]) ?? []);
  }
  useEffect(() => { load(); }, [table, JSON.stringify(filter)]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = { company_id: companyId, ...(staticValues ?? {}) };
    for (const f of fields) {
      const raw = fd.get(f.name);
      const str = raw == null ? "" : String(raw);
      if (f.type === "number") {
        payload[f.name] = str === "" ? (f.nullable ? null : 0) : Number(str);
      } else if (f.nullable) {
        payload[f.name] = str === "" ? null : str;
      } else {
        payload[f.name] = str === "" ? null : str;
      }
    }
    const res = editing
      ? await supabase.from(table as any).update(payload).eq("id", editing.id)
      : await supabase.from(table as any).insert(payload);
    if (res.error) return toast.error(res.error.message);
    setOpen(false); setEditing(null);
    toast.success("Saved");
    load();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-1 h-4 w-4" /> Add {title}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${title}` : `New ${title}`}</DialogTitle>
            </DialogHeader>
            <form className="space-y-3" onSubmit={onSubmit}>
              {fields.map((f) => {
                const cur = editing ? (editing as any)[f.name] : f.defaultValue ?? "";
                return (
                  <div key={f.name} className="space-y-1.5">
                    <Label htmlFor={f.name}>{f.label}</Label>
                    {f.type === "select" ? (
                      <select
                        id={f.name}
                        name={f.name}
                        defaultValue={cur ?? ""}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <Textarea
                        id={f.name}
                        name={f.name}
                        rows={f.rows ?? 5}
                        defaultValue={cur ?? ""}
                      />
                    ) : (
                      <Input
                        id={f.name}
                        name={f.name}
                        type={f.type ?? "text"}
                        step={f.step}
                        defaultValue={cur ?? ""}
                      />
                    )}
                    {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                  </div>
                );
              })}
              {extraFormContent?.(editing)}
              <Button className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No {title} yet.</div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">{render(r)}</div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setEditing(r); setOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
