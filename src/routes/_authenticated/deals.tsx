import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/deals")({
  component: DealsPage,
});

type Deal = {
  id: string;
  client_name: string;
  client_email: string;
  event_date: string | null;
  guest_count: number;
  stage: string;
  estimated_value: number;
  updated_at: string;
};

const STAGE_LABELS: Record<string, string> = {
  inquiry: "Inquiry",
  proposal_draft: "Draft",
  proposal_sent: "Sent",
  client_selected: "Client selected",
  manager_review: "In review",
  accepted: "Accepted",
  lost: "Lost",
};

function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currency = useCompanyCurrency();

  async function refresh() {
    const { data } = await supabase
      .from("deals")
      .select("id, client_name, client_email, event_date, guest_count, stage, estimated_value, updated_at")
      .order("updated_at", { ascending: false });
    setDeals((data as Deal[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Deals"
        description="Every event inquiry, from first contact to accepted proposal."
        action={<NewDealDialog onCreated={(id) => navigate({ to: "/deals/$id", params: { id } })} />}
      />
      {loading ? null : deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          body="Create your first deal to get started."
          action={<NewDealDialog onCreated={(id) => navigate({ to: "/deals/$id", params: { id } })} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {deals.map((d) => (
                <Link
                  key={d.id}
                  to="/deals/$id"
                  params={{ id: d.id }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium">{d.client_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.client_email}
                      {d.event_date && ` · ${new Date(d.event_date).toLocaleDateString()}`}
                      {d.guest_count > 0 && ` · ${d.guest_count} guests`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm tabular-nums">
                      ${Number(d.estimated_value).toLocaleString()}
                    </div>
                    <Badge variant="secondary">{STAGE_LABELS[d.stage] ?? d.stage}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function NewDealDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { data: userData } = await supabase.auth.getUser();
    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", userData.user!.id)
      .limit(1)
      .maybeSingle();
    if (!role?.company_id) {
      setBusy(false);
      return toast.error("No workspace");
    }
    const { data: deal, error } = await supabase
      .from("deals")
      .insert({
        company_id: role.company_id,
        owner_id: userData.user!.id,
        client_name: fd.get("client_name") as string,
        client_email: fd.get("client_email") as string,
        client_company: (fd.get("client_company") as string) || null,
        event_type: (fd.get("event_type") as string) || null,
        event_date: (fd.get("event_date") as string) || null,
        guest_count: Number(fd.get("guest_count") || 0),
        notes: (fd.get("notes") as string) || null,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !deal) return toast.error(error?.message ?? "Failed");
    await supabase.from("deal_activities").insert({
      deal_id: deal.id,
      company_id: role.company_id,
      actor_id: userData.user!.id,
      kind: "deal_created",
    });
    setOpen(false);
    onCreated(deal.id);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> New deal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field name="client_name" label="Client name" required />
            <Field name="client_email" label="Client email" type="email" required />
          </div>
          <Field name="client_company" label="Client company (optional)" />
          <div className="grid grid-cols-3 gap-3">
            <Field name="event_type" label="Event type" placeholder="Wedding, gala..." />
            <Field name="event_date" label="Event date" type="date" />
            <Field name="guest_count" label="Guests" type="number" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          <Button className="w-full" disabled={busy}>
            Create deal
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field(props: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input {...props} id={props.name} />
    </div>
  );
}
