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
import { usePermissions } from "@/lib/use-permissions";
import type { PermissionModule } from "@/lib/permissions";

export type FieldGroup = "basics" | "pricing" | "schedule" | "client";

export const FIELD_GROUP_ORDER: FieldGroup[] = ["basics", "pricing", "schedule", "client"];
export const FIELD_GROUP_LABELS: Record<FieldGroup, string> = {
  basics: "Basics",
  pricing: "Pricing",
  schedule: "Schedule",
  client: "Client-facing",
};

export type Column<T> = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  cell: (row: T) => ReactNode;
};

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "tags" | "weekdays" | "url" | "custom" | "checkbox";
  options?: { value: string; label: string }[];
  suggestions?: string[]; // for type "tags"
  step?: string;
  defaultValue?: string | number | boolean;
  nullable?: boolean;
  hint?: string;
  rows?: number;
  placeholder?: string;
  /** Optional tab grouping. If no field has a group, the form renders ungrouped. */
  group?: FieldGroup;
  /** Optional stacked section header grouping (mutually exclusive with tabs). */
  section?: string;
  // For type "custom": renders arbitrary UI that must write a JSON string to a
  // hidden input named `name`. The stored value is JSON.parse'd on submit.
  render?: (currentValue: any, editingRow: any) => ReactNode;
};

export function CrudList<T extends { id: string }>({
  table,
  companyId,
  fields,
  render,
  columns,
  title,
  filter,
  staticValues,
  extraFormContent,
  module = "catalog",
}: {
  table: string;
  companyId: string | null;
  fields: Field[];
  render: (row: T) => ReactNode;
  columns?: Column<T>[];
  title: string;
  filter?: Record<string, any>; // eq() filters applied on load
  staticValues?: Record<string, any>; // merged into every insert/update payload
  extraFormContent?: (row: T | null) => ReactNode;
  module?: PermissionModule;
}) {
  const { can } = usePermissions();
  const canEdit = can(module, "edit");
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
      if (f.type === "checkbox") {
        payload[f.name] = raw != null;
      } else if (f.type === "number") {
        payload[f.name] = str === "" ? (f.nullable ? null : 0) : Number(str);
      } else if (f.type === "tags" || f.type === "weekdays" || f.type === "custom") {
        try {
          payload[f.name] = str === "" ? (f.type === "custom" ? null : []) : JSON.parse(str);
        } catch {
          // For custom fields, fall back to the raw string (e.g. plain enum values).
          payload[f.name] = f.type === "custom" ? (str === "" ? null : str) : [];
        }
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

  const grouped = fields.some((f) => f.group);
  const groupOf = (f: Field): FieldGroup => f.group ?? "basics";
  const activeGroups = FIELD_GROUP_ORDER.filter((g) => fields.some((f) => groupOf(f) === g));
  const [tab, setTab] = useState<FieldGroup>("basics");
  useEffect(() => {
    if (open) setTab(activeGroups[0] ?? "basics");
  }, [open]);

  function renderField(f: Field) {
    {
                const cur = editing ? (editing as any)[f.name] : f.defaultValue ?? "";
                if (f.type === "custom" && !f.label) {
                  return <div key={f.name}>{f.render ? f.render(cur, editing) : null}</div>;
                }
                if (f.type === "checkbox") {
                  const checked = editing ? Boolean((editing as any)[f.name]) : f.defaultValue !== false;
                  return (
                    <div key={f.name} className="space-y-1.5">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          id={f.name}
                          name={f.name}
                          type="checkbox"
                          defaultChecked={checked}
                          className="h-4 w-4 rounded border"
                        />
                        {f.label}
                      </label>
                      {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                    </div>
                  );
                }
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
                    ) : f.type === "tags" ? (
                      <TagsInput
                        name={f.name}
                        suggestions={f.suggestions ?? []}
                        defaultValue={Array.isArray(cur) ? cur : []}
                      />
                    ) : f.type === "weekdays" ? (
                      <WeekdaysInput
                        name={f.name}
                        defaultValue={Array.isArray(cur) ? cur : []}
                      />
                    ) : f.type === "custom" ? (
                      f.render ? f.render(cur, editing) : null
                    ) : (
                      <Input
                        id={f.name}
                        name={f.name}
                        type={f.type === "url" ? "url" : (f.type ?? "text")}
                        step={f.step}
                        placeholder={f.placeholder}
                        defaultValue={cur ?? ""}
                      />
                    )}
                    {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                  </div>
                );
    }
  }

  return (
    <div>
      <div className={`mb-4 flex justify-end ${canEdit ? "" : "hidden"}`}>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-1 h-4 w-4" /> Add {title}
            </Button>
          </DialogTrigger>
          <DialogContent className={`max-h-[85vh] overflow-y-auto${grouped ? " sm:max-w-2xl" : ""}`}>
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${title}` : `New ${title}`}</DialogTitle>
            </DialogHeader>
            <form className="space-y-3" onSubmit={onSubmit}>
              {grouped ? (
                <>
                  <div className="flex flex-wrap gap-1 border-b pb-2">
                    {activeGroups.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setTab(g)}
                        className={
                          "rounded-md px-3 py-1.5 text-sm transition " +
                          (g === tab
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        {FIELD_GROUP_LABELS[g]}
                      </button>
                    ))}
                  </div>
                  {/* Every group stays mounted so FormData keeps all fields on submit. */}
                  {activeGroups.map((g) => (
                    <div key={g} className={`space-y-3${g === tab ? "" : " hidden"}`}>
                      {fields.filter((f) => groupOf(f) === g).map((f) => renderField(f))}
                    </div>
                  ))}
                </>
              ) : (
                fields.map((f) => renderField(f))
              )}
              {extraFormContent?.(editing)}
              <div className="sticky bottom-0 -mx-6 border-t bg-background px-6 pb-1 pt-3">
                <Button className="w-full">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No {title} yet.</div>
          ) : columns ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        style={c.width ? { width: c.width } : undefined}
                        className={
                          "whitespace-nowrap px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground " +
                          (c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")
                        }
                      >
                        {c.label}
                      </th>
                    ))}
                    <th className={`px-4 py-2 ${canEdit ? "" : "hidden"}`} />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => { if (canEdit) { setEditing(r); setOpen(true); } }}
                      className={`transition hover:bg-muted/30 ${canEdit ? "cursor-pointer" : ""}`}
                    >
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={
                            "whitespace-nowrap px-4 py-3 align-middle " +
                            (c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")
                          }
                        >
                          {c.cell(r)}
                        </td>
                      ))}
                      <td className={`whitespace-nowrap px-4 py-3 text-right ${canEdit ? "" : "hidden"}`}>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setEditing(r); setOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">{render(r)}</div>
                  <div className={`flex gap-1 ${canEdit ? "" : "hidden"}`}>
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

function TagsInput({
  name,
  suggestions,
  defaultValue,
}: {
  name: string;
  suggestions: string[];
  defaultValue: string[];
}) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [input, setInput] = useState("");

  function add(v: string) {
    const val = v.trim();
    if (!val) return;
    if (tags.some((t) => t.toLowerCase() === val.toLowerCase())) return;
    setTags([...tags, val]);
    setInput("");
  }
  function remove(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  const available = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                className="hover:text-destructive"
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder="Add a custom feature and press Enter"
        />
        <Button type="button" variant="outline" onClick={() => add(input)}>
          Add
        </Button>
      </div>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekdaysInput({ name, defaultValue }: { name: string; defaultValue: number[] }) {
  const [days, setDays] = useState<number[]>(defaultValue.length ? defaultValue : [0, 1, 2, 3, 4, 5, 6]);
  const WEEKDAYS = [
    { d: 0, s: "Sun" }, { d: 1, s: "Mon" }, { d: 2, s: "Tue" }, { d: 3, s: "Wed" },
    { d: 4, s: "Thu" }, { d: 5, s: "Fri" }, { d: 6, s: "Sat" },
  ];
  function toggle(d: number) {
    setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <input type="hidden" name={name} value={JSON.stringify(days)} />
      {WEEKDAYS.map((w) => {
        const active = days.includes(w.d);
        return (
          <button
            key={w.d}
            type="button"
            onClick={() => toggle(w.d)}
            className={
              "rounded-full border px-2 py-0.5 text-xs transition " +
              (active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground")
            }
          >
            {w.s}
          </button>
        );
      })}
    </div>
  );
}
