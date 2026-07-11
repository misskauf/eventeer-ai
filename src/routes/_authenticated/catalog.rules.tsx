import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createFileRoute as _ } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";
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
      <GratuitySection companyId={companyId} />
      <SeasonsSection companyId={companyId} />
      <RulesSection companyId={companyId} />
    </div>
  );
}

/* ---------------- Service charge / tip ---------------- */

type GratuityType = "service_charge" | "tip";
type GratuityMode = "fixed" | "slider";

type GratuityConfig = {
  gratuity_type: GratuityType;
  gratuity_mode: GratuityMode;
  gratuity_fixed_pct: number;
  gratuity_min_pct: number;
  gratuity_max_pct: number;
  gratuity_default_pct: number;
  gratuity_tax_rate_pct: number;
};

function GratuitySection({ companyId }: { companyId: string | null }) {
  const [cfg, setCfg] = useState<GratuityConfig | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!companyId) return;
    const { data } = await supabase
      .from("fee_config")
      .select(
        "gratuity_type, gratuity_mode, gratuity_fixed_pct, gratuity_min_pct, gratuity_max_pct, gratuity_default_pct, gratuity_tax_rate_pct",
      )
      .eq("company_id", companyId)
      .maybeSingle();
    if (data) setCfg(data as GratuityConfig);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function save() {
    if (!companyId || !cfg) return;
    setSaving(true);
    const { error } = await supabase
      .from("fee_config")
      .update(cfg)
      .eq("company_id", companyId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  if (!cfg) return null;
  const set = <K extends keyof GratuityConfig>(k: K, v: GratuityConfig[K]) =>
    setCfg({ ...cfg, [k]: v });

  const Seg = ({
    value,
    options,
    onChange,
  }: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <div className="inline-flex rounded-md border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-sm px-3 py-1 text-xs ${
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Service charge &amp; tip
        </h2>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Seg
                value={cfg.gratuity_type}
                onChange={(v) => set("gratuity_type", v as GratuityType)}
                options={[
                  { value: "service_charge", label: "Service charge (taxed)" },
                  { value: "tip", label: "Tip (untaxed)" },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                Service charges are calculated on net and taxed at the rate below. Tips are added
                gross with no tax.
              </p>
            </div>
            {cfg.gratuity_type === "service_charge" && (
              <div className="space-y-1.5">
                <Label htmlFor="grat_tax">Service tax rate %</Label>
                <Input
                  id="grat_tax"
                  type="number"
                  step="0.01"
                  value={cfg.gratuity_tax_rate_pct}
                  onChange={(e) =>
                    set("gratuity_tax_rate_pct", Number(e.target.value))
                  }
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Rate mode</Label>
            <Seg
              value={cfg.gratuity_mode}
              onChange={(v) => set("gratuity_mode", v as GratuityMode)}
              options={[
                { value: "fixed", label: "Fixed rate" },
                { value: "slider", label: "Client slider" },
              ]}
            />
          </div>

          {cfg.gratuity_mode === "fixed" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="grat_fixed">Fixed rate %</Label>
                <Input
                  id="grat_fixed"
                  type="number"
                  step="0.1"
                  value={cfg.gratuity_fixed_pct}
                  onChange={(e) =>
                    set("gratuity_fixed_pct", Number(e.target.value))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="grat_min">Minimum %</Label>
                <Input
                  id="grat_min"
                  type="number"
                  step="0.1"
                  value={cfg.gratuity_min_pct}
                  onChange={(e) => set("gratuity_min_pct", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grat_max">Maximum %</Label>
                <Input
                  id="grat_max"
                  type="number"
                  step="0.1"
                  value={cfg.gratuity_max_pct}
                  onChange={(e) => set("gratuity_max_pct", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grat_default">Default %</Label>
                <Input
                  id="grat_default"
                  type="number"
                  step="0.1"
                  value={cfg.gratuity_default_pct}
                  onChange={(e) =>
                    set("gratuity_default_pct", Number(e.target.value))
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
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

function BasisToggle({
  value,
  onChange,
}: {
  value: Basis;
  onChange: (v: Basis) => void;
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {(["gross", "net"] as Basis[]).map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => onChange(b)}
          className={`rounded-sm px-3 py-1 text-xs capitalize ${
            value === b
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {b}
        </button>
      ))}
    </div>
  );
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
  const [basis, setBasis] = useState<Basis>(initial?.basis ?? "gross");

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
      basis,
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
      <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-1.5">
          <Label>Applies to</Label>
          <BasisToggle value={basis} onChange={setBasis} />
        </div>
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
  space_ids: string[] | null;
  min_revenue: number;
  basis: Basis;
};

type SpaceLite = { id: string; name: string };

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
function formatRuleSpaces(ids: string[] | null | undefined, spaces: SpaceLite[]) {
  if (!ids || ids.length === 0) return "All spaces";
  const names = ids
    .map((id) => spaces.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];
  if (!names.length) return "All spaces";
  return names.join(", ");
}


function RulesSection({ companyId }: { companyId: string | null }) {
  const [rows, setRows] = useState<Rule[]>([]);
  const [spaces, setSpaces] = useState<SpaceLite[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const currency = useCompanyCurrency();

  async function load() {
    const { data } = await supabase
      .from("pricing_rules")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Rule[]) ?? []);
  }
  async function loadSpaces() {
    if (!companyId) return;
    const { data } = await supabase
      .from("spaces")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name");
    setSpaces((data as SpaceLite[]) ?? []);
  }
  useEffect(() => {
    load();
    loadSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

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
              spaces={spaces}
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
                      {formatMonths(r.months)} ·{" "}
                      {formatRuleSpaces(r.space_ids, spaces)} · min{" "}
                      {money(Number(r.min_revenue), currency)} ({r.basis})
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
  spaces,
  onSaved,
}: {
  companyId: string | null;
  initial: Rule | null;
  spaces: SpaceLite[];
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [days, setDays] = useState<number[]>(initial?.days_of_week ?? []);
  const [months, setMonths] = useState<number[]>(initial?.months ?? []);
  const [spaceIds, setSpaceIds] = useState<string[]>(initial?.space_ids ?? []);
  const [minRevenue, setMinRevenue] = useState<string>(
    initial ? String(initial.min_revenue) : "0",
  );
  const [basis, setBasis] = useState<Basis>(initial?.basis ?? "gross");

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
  function toggleSpace(id: string) {
    setSpaceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    const payload = {
      company_id: companyId,
      notes: notes || null,
      days_of_week: days,
      months,
      space_ids: spaceIds,
      day_of_week: null,
      month: null,
      min_revenue: Number(minRevenue),
      basis,
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
      <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-1.5">
          <Label>Amount is</Label>
          <BasisToggle value={basis} onChange={setBasis} />
        </div>
      </div>
      <Button className="w-full">Save</Button>
    </form>
  );
}
