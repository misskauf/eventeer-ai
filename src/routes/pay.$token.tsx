import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPaymentCheckout } from "@/lib/payments.functions";
import { resolvePaymentToken } from "@/lib/payments.functions";
import { effectiveStatus, payCopy, STATUS_LABELS, STATUS_TONES, summarize } from "@/lib/payments";

export const Route = createFileRoute("/pay/$token")({
  loader: ({ params }) => resolvePaymentToken({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Payment schedule | Eventeer" },
      {
        name: "description",
        content: "View your event payment schedule, amounts, due dates and bank transfer details.",
      },
      { property: "og:title", content: "Payment schedule | Eventeer" },
      {
        property: "og:description",
        content: "View your event payment schedule, amounts, due dates and bank transfer details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => (
    <Shell>
      <p className="text-sm text-muted-foreground">This payment link could not be loaded.</p>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="text-sm text-muted-foreground">This payment link is not valid.</p>
    </Shell>
  ),
  component: PaymentPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10">
      <div className="rounded-lg border bg-card p-6 shadow-sm">{children}</div>
    </main>
  );
}

function money(currency: string, n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function PayButton({ token, paymentId, label }: { token: string; paymentId: string; label: string }) {
  const checkout = useServerFn(createPaymentCheckout);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const res: any = await checkout({
        data: { token, paymentId, origin: window.location.origin },
      });
      window.location.href = res.url;
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start the card payment");
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={go} disabled={busy}>
      {busy ? "Opening…" : label}
    </Button>
  );
}

function PaymentPage() {
  const data = Route.useLoaderData() as any;
  const params = Route.useParams();

  if (!data?.ok) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Payment link unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data?.reason === "expired" ? "This link has expired." : "This link is no longer valid."}
        </p>
      </Shell>
    );
  }

  const { deal, company, payments } = data;
  const c = payCopy(deal.language);
  const currency = company.currency ?? "EUR";
  const summary = summarize(payments);
  const stripeOn = Boolean(company.stripe_enabled);
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const justPaid = search?.get("paid") === "1";

  return (
    <Shell>
      <header className="mb-5 flex items-center gap-3">
        {company.logo_url && (
          <img src={company.logo_url} alt={`${company.name} logo`} className="h-10 w-10 rounded object-contain" />
        )}
        <div>
          <h1 className="text-lg font-semibold">{c.page_title}</h1>
          <p className="text-sm text-muted-foreground">
            {company.name} · {deal.client_name}
            {deal.event_date ? ` · ${deal.event_date}` : ""}
          </p>
        </div>
      </header>

      {justPaid && (
        <p className="mb-4 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm">
          Thank you — your payment is being processed. This page updates once it settles.
        </p>
      )}

      <div className="overflow-hidden rounded-md border text-sm">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted/50 px-3 py-2 text-xs font-medium">
          <span>{c.amount}</span>
          <span>{c.due}</span>
          <span>{c.status}</span>
        </div>
        {payments.map((p: any) => {
          const st = effectiveStatus(p);
          return (
            <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t px-3 py-2">
              <span>
                <span className="block font-medium">{p.label}</span>
                <span className="text-xs text-muted-foreground">{money(currency, Number(p.amount))}</span>
              </span>
              <span className="text-xs text-muted-foreground">{p.due_date ?? "—"}</span>
              <span className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_TONES[st]}`}>{STATUS_LABELS[st]}</span>
                {stripeOn && st !== "paid" && (
                  <PayButton token={params.token} paymentId={p.id} label={c.pay_card} />
                )}
              </span>
            </div>
          );
        })}
        {payments.length === 0 && (
          <div className="border-t px-3 py-4 text-sm text-muted-foreground">—</div>
        )}
        <div className="flex justify-between border-t bg-muted/40 px-3 py-2 text-xs">
          <span>
            {c.paid}: <strong>{money(currency, summary.paid)}</strong>
          </span>
          <span>
            {c.outstanding}: <strong>{money(currency, summary.outstanding)}</strong>
          </span>
        </div>
      </div>

      {(company.bank_iban || company.bank_name || company.bank_account_name) && (
        <section className="mt-5 rounded-md border p-3 text-sm">
          <h2 className="mb-2 font-medium">{c.bank_title}</h2>
          <dl className="space-y-1 text-sm">
            {company.bank_account_name && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{c.account_name}</dt>
                <dd>{company.bank_account_name}</dd>
              </div>
            )}
            {company.bank_name && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{c.bank}</dt>
                <dd>{company.bank_name}</dd>
              </div>
            )}
            {company.bank_iban && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">IBAN</dt>
                <dd className="font-mono">{company.bank_iban}</dd>
              </div>
            )}
            {company.bank_bic && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">BIC</dt>
                <dd className="font-mono">{company.bank_bic}</dd>
              </div>
            )}
            {company.payment_reference_note && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{c.reference}</dt>
                <dd>{company.payment_reference_note}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {company.invoice_notes && (
        <p className="mt-4 whitespace-pre-line text-xs text-muted-foreground">{company.invoice_notes}</p>
      )}
    </Shell>
  );
}
