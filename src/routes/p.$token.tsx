import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveProposalToken, submitClientSelection } from "@/lib/public-share.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { computeTotals, money, type Offer, type Selection, type SpaceSel, type PackageSel, type ExtraSel } from "@/lib/pricing";
import { toast } from "sonner";

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  component: ClientProposal,
});

function ClientProposal() {
  const { token } = Route.useParams();
  const resolve = useServerFn(resolveProposalToken);
  const submit = useServerFn(submitClientSelection);
  const navigate = useNavigate();

  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<SpaceSel[]>([]);
  const [packages, setPackages] = useState<PackageSel[]>([]);
  const [extras, setExtras] = useState<ExtraSel[]>([]);
  const [seasonMult, setSeasonMult] = useState(1);
  const [minRev, setMinRev] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [feesCfg, setFeesCfg] = useState<any>(null);

  const [selSpaces, setSelSpaces] = useState<string[]>([]);
  const [selPkgs, setSelPkgs] = useState<string[]>([]);
  const [selExtras, setSelExtras] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await resolve({ data: { token } });
      if (!res.ok) return setError(res.reason ?? "not_found");
      setState(res);
      const offerCfg: any = res.proposal.offer ?? {};
      const cons: any = res.proposal.constraints ?? {};
      const [sp, pk, ex, fc, ss] = await Promise.all([
        supabase.from("spaces").select("id, name, base_rental_fee, min_rental_fee").in("id", offerCfg.space_ids ?? []),
        supabase.from("fb_packages").select("id, name, price_per_person").in("id", offerCfg.package_ids ?? []),
        supabase.from("extras").select("id, name, pricing_type, price").in("id", offerCfg.extra_ids ?? []),
        supabase.from("fee_config").select("*").eq("company_id", res.company.id).maybeSingle(),
        offerCfg.season_id && offerCfg.season_id !== "none"
          ? supabase.from("pricing_seasons").select("multiplier").eq("id", offerCfg.season_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setSpaces((sp.data as SpaceSel[]) ?? []);
      setPackages((pk.data as PackageSel[]) ?? []);
      setExtras((ex.data as ExtraSel[]) ?? []);
      setFeesCfg(fc.data);
      setSeasonMult((ss as any).data?.multiplier ?? 1);
      setDiscount(offerCfg.discount ?? 0);
      setMinRev(offerCfg.min_revenue_required ?? 0);
      // Preselect everything the manager included
      setSelSpaces(offerCfg.space_ids ?? []);
      setSelPkgs(offerCfg.package_ids ?? []);
      setSelExtras(offerCfg.extra_ids ?? []);
      // touch cons to satisfy TS unused
      void cons;
    })();
  }, [token]);

  const offer: Offer | null = useMemo(() => {
    if (!feesCfg) return null;
    return {
      spaces, packages, extras,
      fees: { ...feesCfg, overtime_hours: 0 },
      season_multiplier: seasonMult,
      min_revenue_required: minRev,
      discount,
    };
  }, [spaces, packages, extras, feesCfg, seasonMult, discount, minRev]);

  const totals = useMemo(() => {
    if (!offer || !state) return null;
    const sel: Selection = {
      guest_count: state.deal.guest_count,
      space_ids: selSpaces,
      package_ids: selPkgs,
      extra_ids: selExtras,
    };
    return computeTotals(offer, sel);
  }, [offer, selSpaces, selPkgs, selExtras, state]);

  if (error === "expired") return <Message title="This link has expired" body="Please ask your event manager for a fresh link." />;
  if (error) return <Message title="Proposal not found" body="This link is invalid or has been revoked." />;
  if (!state || !totals) return <div className="p-8 text-center text-muted-foreground">Loading proposal…</div>;

  const brand = state.company.primary_color as string;
  const currency = state.company.currency as string;

  async function onSubmit() {
    await submit({
      data: {
        token,
        selection: {
          guest_count: state.deal.guest_count,
          space_ids: selSpaces,
          package_ids: selPkgs,
          extra_ids: selExtras,
        },
        computed_total: totals!.grand_total,
      },
    });
    setSubmitted(true);
    toast.success("Your selection was sent to the event manager.");
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background" style={{ borderTopColor: brand, borderTopWidth: 4 }}>
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          {state.company.logo_url ? (
            <img src={state.company.logo_url} className="h-10 w-10 rounded object-cover" alt="" />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded text-sm font-semibold text-white" style={{ backgroundColor: brand }}>
              {state.company.name?.[0]}
            </div>
          )}
          <div>
            <div className="font-semibold">{state.company.name}</div>
            <div className="text-xs text-muted-foreground">Proposal for {state.deal.client_name}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {state.proposal.constraints?.client_message && (
          <Card className="mb-6">
            <CardContent className="pt-6 whitespace-pre-wrap text-sm">
              {state.proposal.constraints.client_message}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <OptionGroup title="Spaces" items={spaces.map((s) => ({
              id: s.id, name: s.name, note: `From ${money(s.base_rental_fee, currency)}`,
            }))} selected={selSpaces} onToggle={(id, v) => toggle(setSelSpaces, id, v)} />
            <OptionGroup title="Food & Beverage" items={packages.map((p) => ({
              id: p.id, name: p.name, note: `${money(p.price_per_person, currency)} / guest`,
            }))} selected={selPkgs} onToggle={(id, v) => toggle(setSelPkgs, id, v)} />
            <OptionGroup title="Extras" items={extras.map((e) => ({
              id: e.id, name: e.name, note: `${money(e.price, currency)} ${e.pricing_type.replace("_", " ")}`,
            }))} selected={selExtras} onToggle={(id, v) => toggle(setSelExtras, id, v)} />
          </div>

          <div>
            <Card className="sticky top-4">
              <CardHeader><CardTitle>Your total</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {totals.lines.map((l, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{l.label}</span>
                    <span className="tabular-nums">{money(l.amount, currency)}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <Row label="Subtotal" value={money(totals.subtotal, currency)} />
                {discount > 0 && <Row label="Discount" value={"-" + money(discount, currency)} />}
                <Row label="Service" value={money(totals.service_charge, currency)} />
                <Row label="Tax" value={money(totals.tax, currency)} />
                <Separator className="my-2" />
                <Row label={<b>Grand total</b>} value={<b>{money(totals.grand_total, currency)}</b>} />
                {totals.min_shortfall > 0 && (
                  <div className="mt-3 rounded-md bg-yellow-50 p-2 text-xs text-yellow-900">
                    Add {money(totals.min_shortfall, currency)} more to meet the venue minimum.
                  </div>
                )}
                <Button
                  className="mt-4 w-full"
                  style={{ backgroundColor: brand }}
                  onClick={onSubmit}
                  disabled={submitted}
                >
                  {submitted ? "Sent" : "Confirm my selection"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function OptionGroup({
  title, items, selected, onToggle,
}: {
  title: string;
  items: { id: string; name: string; note: string }[];
  selected: string[];
  onToggle: (id: string, v: boolean | "indeterminate") => void;
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((i) => (
          <label key={i.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/40">
            <Checkbox checked={selected.includes(i.id)} onCheckedChange={(v) => onToggle(i.id, v)} />
            <div className="flex-1">
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-muted-foreground">{i.note}</div>
            </div>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return <div className="flex justify-between"><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function toggle(set: React.Dispatch<React.SetStateAction<string[]>>, id: string, v: boolean | "indeterminate") {
  set((cur) => (v ? Array.from(new Set([...cur, id])) : cur.filter((x) => x !== id)));
}
