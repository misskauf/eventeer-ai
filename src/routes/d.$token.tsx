import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveDashboardToken } from "@/lib/public-share.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/d/$token")({
  ssr: false,
  component: SharedDashboard,
});

function SharedDashboard() {
  const { token } = Route.useParams();
  const resolve = useServerFn(resolveDashboardToken);
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await resolve({ data: { token } });
      if (!res.ok) return setError("not_found");
      setState(res);
    })();
  }, [token]);

  if (error) return <div className="grid min-h-screen place-items-center text-muted-foreground">Link invalid.</div>;
  if (!state) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;

  const { deal, company, activities, proposals } = state;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background" style={{ borderTopColor: company.primary_color, borderTopWidth: 4 }}>
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          {company.logo_url ? (
            <img src={company.logo_url} className="h-10 w-10 rounded object-cover" alt="" />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded text-sm font-semibold text-white" style={{ backgroundColor: company.primary_color }}>
              {company.name?.[0]}
            </div>
          )}
          <div>
            <div className="font-semibold">{company.name}</div>
            <div className="text-xs text-muted-foreground">Deal dashboard · {deal.client_name}</div>
          </div>
          <Badge variant="secondary" className="ml-auto">{deal.stage.replace(/_/g, " ")}</Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 px-6 py-8 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Deal</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Client" value={deal.client_name} />
            <Row label="Contact" value={deal.client_email} />
            {deal.event_type && <Row label="Type" value={deal.event_type} />}
            {deal.event_date && <Row label="Date" value={new Date(deal.event_date).toLocaleDateString()} />}
            <Row label="Guests" value={String(deal.guest_count ?? 0)} />
            <Row label="Estimated value" value={`${company.currency} ${Number(deal.estimated_value).toLocaleString()}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Proposals</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {proposals.length === 0 && <div className="text-muted-foreground">No proposals yet.</div>}
            {proposals.map((p: any) => (
              <div key={p.id} className="flex justify-between">
                <span>v{p.version} · {p.status}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.sent_at ?? p.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {activities.length === 0 && <div className="text-muted-foreground">No activity yet.</div>}
            {activities.map((a: any) => (
              <div key={a.id} className="flex justify-between">
                <span>{a.kind.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
