import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createFileRoute as _ } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/catalog/rules")({
  component: RulesPage,
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function daysInMonth(monthIdx: number, year: number) {
  return new Date(year, monthIdx + 1, 0).getDate();
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function monthFromDate(d: string | null | undefined): number | null {
  if (!d) return null;
  const parts = d.split("-");
  if (parts.length < 2) return null;
  const m = Number(parts[1]);
  return Number.isFinite(m) ? m - 1 : null;
}

function RulesPage() {
  const { companyId } = useCurrentCompany();
  return (
    <div className="space-y-8">
      <SeasonsSection companyId={companyId} />
      <RulesSection companyId={companyId} />
    </div>
  );
}

/* ---------------- Seasons ---------------- */

type Basis = "net" | "gross";
type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  multiplier: number;
  days_of_week: number[] | null;
  basis: Basis;
};

function formatDays(days: number[] | null | undefined) {
  if (!days || days.length === 0) return "All days";
  if (days.length === 7) return "All days";
  const sorted = [...days].sort((a, b) => a - b);
  return sorted.map((d) => DAYS[d].slice(0, 3)).join(", ");
}

function SeasonsSection({ companyId }: { companyId: string | null }) {
  const [rows, setRows] = useState<Season[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);

  async function load() {
    const { data } = await supabase
      .from("pricing_seasons")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Season[]) ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: string) {
    if (!confirm("Delete this season?")) return;
    const { error } = await supabase.from("pricing_seasons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Seasons (price multipliers)
        </h2>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-1 h-4 w-4" /> Add season
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit season" : "New season"}</DialogTitle>
            </DialogHeader>
            <SeasonForm
              companyId={companyId}
              initial={editing}
              onSaved={() => {
                setOpen(false);
                setEditing(null);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No seasons yet.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => {
                const sm = monthFromDate(r.start_date);
                const em = monthFromDate(r.end_date);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {sm !== null ? MONTHS[sm] : r.start_date} →{" "}
                        {em !== null ? MONTHS[em] : r.end_date} ·{" "}
                        {formatDays(r.days_of_week)} · ×{r.multiplier} ·{" "}
                        {r.basis === "net" ? "Net" : "Gross"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function SeasonForm({
  companyId,
  initial,
  onSaved,
}: {
  companyId: string | null;
  initial: Season | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startMonth, setStartMonth] = useState<number>(
    initial ? monthFromDate(initial.start_date) ?? 0 : 0,
  );
  const [endMonth, setEndMonth] = useState<number>(
    initial ? monthFromDate(initial.end_date) ?? 0 : 0,
  );
  const [multiplier, setMultiplier] = useState<string>(
    initial ? String(initial.multiplier) : "1",
  );
  const [days, setDays] = useState<number[]>(initial?.days_of_week ?? []);

  function toggleDay(i: number) {
    setDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    const year = new Date().getFullYear();
    const start_date = `${year}-${pad(startMonth + 1)}-01`;
    const end_date = `${year}-${pad(endMonth + 1)}-${pad(daysInMonth(endMonth, year))}`;
    const payload = {
      company_id: companyId,
      name,
      start_date,
      end_date,
      multiplier: Number(multiplier),
      days_of_week: days,
    };
    const res = initial
      ? await supabase.from("pricing_seasons").update(payload).eq("id", initial.id)
      : await supabase.from("pricing_seasons").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Start month</Label>
          <Select
            value={String(startMonth)}
            onValueChange={(v) => setStartMonth(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>End month</Label>
          <Select
            value={String(endMonth)}
            onValueChange={(v) => setEndMonth(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Days of week</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const on = days.includes(i);
            return (
              <button
                type="button"
                key={d}
                onClick={() => toggleDay(i)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Leave empty to apply to all days.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mult">Multiplier (e.g. 1.25)</Label>
        <Input
          id="mult"
          type="number"
          step="0.01"
          value={multiplier}
          onChange={(e) => setMultiplier(e.target.value)}
          required
        />
      </div>
      <Button className="w-full">Save</Button>
    </form>
  );
}

/* ---------------- Rules ---------------- */

type Rule = {
  id: string;
  notes: string | null;
  days_of_week: number[] | null;
  months: number[] | null;
  min_revenue: number;
};

function formatMonths(months: number[] | null | undefined) {
  if (!months || months.length === 0) return "Any month";
  if (months.length === 12) return "Any month";
  const sorted = [...months].sort((a, b) => a - b);
  return sorted.map((m) => MONTHS[m - 1].slice(0, 3)).join(", ");
}
function formatRuleDays(days: number[] | null | undefined) {
  if (!days || days.length === 0) return "Any day";
  if (days.length === 7) return "Any day";
  const sorted = [...days].sort((a, b) => a - b);
  return sorted.map((d) => DAYS[d].slice(0, 3)).join(", ");
}

function RulesSection({ companyId }: { companyId: string | null }) {
  const [rows, setRows] = useState<Rule[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);

  async function load() {
    const { data } = await supabase
      .from("pricing_rules")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Rule[]) ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: string) {
    if (!confirm("Delete this rule?")) return;
    const { error } = await supabase.from("pricing_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Minimum-revenue rules
        </h2>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-1 h-4 w-4" /> Add rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit rule" : "New rule"}</DialogTitle>
            </DialogHeader>
            <RuleForm
              companyId={companyId}
              initial={editing}
              onSaved={() => {
                setOpen(false);
                setEditing(null);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No rules yet.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.notes ?? "Rule"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatRuleDays(r.days_of_week)} ·{" "}
                      {formatMonths(r.months)} · min $
                      {Number(r.min_revenue).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
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
    </section>
  );
}

function RuleForm({
  companyId,
  initial,
  onSaved,
}: {
  companyId: string | null;
  initial: Rule | null;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [days, setDays] = useState<number[]>(initial?.days_of_week ?? []);
  const [months, setMonths] = useState<number[]>(initial?.months ?? []);
  const [minRevenue, setMinRevenue] = useState<string>(
    initial ? String(initial.min_revenue) : "0",
  );

  function toggleDay(i: number) {
    setDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b),
    );
  }
  function toggleMonth(i: number) {
    setMonths((prev) =>
      prev.includes(i) ? prev.filter((m) => m !== i) : [...prev, i].sort((a, b) => a - b),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    const payload = {
      company_id: companyId,
      notes: notes || null,
      days_of_week: days,
      months,
      day_of_week: null,
      month: null,
      min_revenue: Number(minRevenue),
    };
    const res = initial
      ? await supabase.from("pricing_rules").update(payload).eq("id", initial.id)
      : await supabase.from("pricing_rules").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Label / notes</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Days of week</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const on = days.includes(i);
            return (
              <button
                type="button"
                key={d}
                onClick={() => toggleDay(i)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Leave empty for any day.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Months</Label>
        <div className="flex flex-wrap gap-1.5">
          {MONTHS.map((m, i) => {
            const on = months.includes(i + 1);
            return (
              <button
                type="button"
                key={m}
                onClick={() => toggleMonth(i + 1)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {m.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Leave empty for any month.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="min">Minimum revenue required</Label>
        <Input
          id="min"
          type="number"
          step="0.01"
          value={minRevenue}
          onChange={(e) => setMinRevenue(e.target.value)}
          required
        />
      </div>
      <Button className="w-full">Save</Button>
    </form>
  );
}
