import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getCompanyAuditLog,
  listPlatformPrices,
  setCompanyBilling,
  setCompanyPlan,
  type PlatformCompany,
} from "@/lib/platform.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

type Action = "activate" | "extend_trial" | "comp" | "lock";

const STATUSES = ["all", "trialing", "active", "past_due", "expired", "comped"] as const;

function statusVariant(status: string) {
  if (status === "active" || status === "comped") return "default" as const;
  if (status === "expired") return "destructive" as const;
  return "secondary" as const;
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export function PlatformCompanyTable({ companies }: { companies: PlatformCompany[] }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<{ company: PlatformCompany; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [days, setDays] = useState("30");
  const [planFor, setPlanFor] = useState<PlatformCompany | null>(null);
  const [planPrice, setPlanPrice] = useState("");
  const [planCoupon, setPlanCoupon] = useState("");

  const fetchPrices = useServerFn(listPlatformPrices);
  const pricesQuery = useQuery({ queryKey: ["platform-prices"], queryFn: () => fetchPrices() });

  const savePlan = useServerFn(setCompanyPlan);
  const planMutation = useMutation({
    mutationFn: (vars: { companyId: string; priceId: string | null; couponId: string | null }) =>
      savePlan({ data: vars }),
    onSuccess: () => {
      toast.success("Plan updated");
      setPlanFor(null);
      void qc.invalidateQueries({ queryKey: ["platform-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useServerFn(setCompanyBilling);
  const mutation = useMutation({
    mutationFn: (vars: { companyId: string; action: Action; note?: string; days?: number }) =>
      apply({ data: vars }),
    onSuccess: () => {
      toast.success("Account updated");
      setPending(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["platform-overview"] });
      void qc.invalidateQueries({ queryKey: ["platform-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openPlan(c: PlatformCompany) {
    setPlanFor(c);
    setPlanPrice(c.stripe_price_id ?? "");
    setPlanCoupon(c.stripe_coupon_id ?? "");
  }

  function planLabel(c: PlatformCompany) {
    const p = pricesQuery.data?.prices.find((x) => x.stripe_price_id === c.stripe_price_id);
    if (p) return p.label;
    return c.stripe_price_id ? "Custom" : "Default";
  }


  const rows = useMemo(
    () =>
      companies.filter(
        (c) =>
          (status === "all" || c.subscription_status === status) &&
          c.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [companies, search, status],
  );

  function open(company: PlatformCompany, action: Action) {
    setPending({ company, action });
    setNote(company.billing_note ?? "");
    setDays("30");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "All" : s}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} companies</span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Company</TableHead>
              <TableHead>Signed up</TableHead>
              <TableHead>Trial ends</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Renews</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <>
                <TableRow key={c.id}>
                  <TableCell>
                    <button
                      type="button"
                      aria-label="Toggle history"
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                      className="text-muted-foreground"
                    >
                      {expanded === c.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{fmt(c.created_at)}</TableCell>
                  <TableCell>{fmt(c.trial_ends_at)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.subscription_status)}>
                      {c.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {planLabel(c)}
                    {c.stripe_coupon_id ? " · coupon" : ""}
                    {c.stripe_subscription_id ? " · Stripe" : ""}
                  </TableCell>
                  <TableCell>{fmt(c.current_period_end)}</TableCell>
                  <TableCell className="text-right">{c.user_count}</TableCell>
                  <TableCell>{fmt(c.last_activity)}</TableCell>
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => openPlan(c)}>
                      Plan
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => open(c, "activate")}>
                      Activate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => open(c, "extend_trial")}>
                      Extend
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => open(c, "comp")}>
                      Comp
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => open(c, "lock")}>
                      Lock
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded === c.id && (
                  <TableRow key={`${c.id}-log`}>
                    <TableCell colSpan={10} className="bg-muted/30">
                      <AuditLog companyId={c.id} note={c.billing_note} />
                    </TableCell>
                  </TableRow>
                )}

              </>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.action === "activate" && "Activate account"}
              {pending?.action === "extend_trial" && "Extend trial"}
              {pending?.action === "comp" && "Comp account"}
              {pending?.action === "lock" && "Lock account"}
            </DialogTitle>
            <DialogDescription>
              {pending?.company.name} — no data is deleted, this only changes access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pending?.action === "extend_trial" && (
              <div className="space-y-1.5">
                <Label htmlFor="days">Extra days</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="note">
                Billing note {pending?.action === "activate" ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                id="note"
                value={note}
                placeholder="paid by transfer, invoice #123"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() =>
                pending &&
                mutation.mutate({
                  companyId: pending.company.id,
                  action: pending.action,
                  note: note.trim() || undefined,
                  ...(pending.action === "extend_trial"
                    ? { days: Math.max(1, Number(days) || 30) }
                    : {}),
                })
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!planFor} onOpenChange={(o) => !o && setPlanFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign plan</DialogTitle>
            <DialogDescription>
              {planFor?.name} — applies to their next checkout. Leave empty for the default plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Stripe price</Label>
              <select
                id="price"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={planPrice}
                onChange={(e) => setPlanPrice(e.target.value)}
              >
                <option value="">
                  Default{pricesQuery.data?.defaultPriceId ? ` (${pricesQuery.data.defaultPriceId})` : ""}
                </option>
                {(pricesQuery.data?.prices ?? []).map((p) => (
                  <option key={p.stripe_price_id} value={p.stripe_price_id}>
                    {p.label} — {(p.amount_cents / 100).toFixed(2)} {p.currency}/{p.interval}
                  </option>
                ))}
                {planPrice &&
                  !(pricesQuery.data?.prices ?? []).some((p) => p.stripe_price_id === planPrice) && (
                    <option value={planPrice}>{planPrice}</option>
                  )}
              </select>
              <Input
                placeholder="…or paste a custom price id (price_…)"
                value={planPrice}
                onChange={(e) => setPlanPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon">Coupon id (optional)</Label>
              <Input
                id="coupon"
                placeholder="coupon_…"
                value={planCoupon}
                onChange={(e) => setPlanCoupon(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                With a coupon set, promotion-code entry is disabled at checkout.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlanFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={planMutation.isPending}
              onClick={() =>
                planFor &&
                planMutation.mutate({
                  companyId: planFor.id,
                  priceId: planPrice.trim() || null,
                  couponId: planCoupon.trim() || null,
                })
              }
            >
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}

function AuditLog({ companyId, note }: { companyId: string; note: string | null }) {
  const fetchLog = useServerFn(getCompanyAuditLog);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-audit", companyId],
    queryFn: () => fetchLog({ data: { companyId } }),
  });

  return (
    <div className="space-y-2 py-2 text-sm">
      {note && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Billing note:</span> {note}
        </p>
      )}
      {isLoading && <p className="text-muted-foreground">Loading history…</p>}
      {!isLoading && (data?.rows.length ?? 0) === 0 && (
        <p className="text-muted-foreground">No platform actions recorded yet.</p>
      )}
      <ul className="space-y-1">
        {(data?.rows ?? []).map((r) => {
          const detail = (r.detail ?? {}) as {
            note?: string | null;
            days?: number | null;
            previous_status?: string;
            new_status?: string;
          };
          return (
            <li key={r.id} className="text-muted-foreground">
              <span className="text-foreground">{new Date(r.created_at).toLocaleString()}</span>{" "}
              — {r.action}
              {detail.days ? ` (+${detail.days} days)` : ""}
              {detail.previous_status ? `: ${detail.previous_status} → ${detail.new_status}` : ""}
              {detail.note ? ` — "${detail.note}"` : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
