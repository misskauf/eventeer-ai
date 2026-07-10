import { money } from "@/lib/pricing";
import { splitNetTaxGross, type Basis } from "@/lib/tax";

export function PriceBreakdown({
  amount,
  basis,
  taxRatePct,
  currency,
  compact = false,
}: {
  amount: number;
  basis: Basis;
  taxRatePct: number;
  currency: string;
  compact?: boolean;
}) {
  const { net, tax, gross } = splitNetTaxGross(amount, basis, taxRatePct);
  if (compact) {
    return (
      <span className="tabular-nums">
        Net {money(net, currency)} · Tax {money(tax, currency)} ({taxRatePct}%) · Gross {money(gross, currency)}
      </span>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <Stat label="Net" value={money(net, currency)} />
      <Stat label={`Tax (${taxRatePct}%)`} value={money(tax, currency)} />
      <Stat label="Gross" value={money(gross, currency)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}
