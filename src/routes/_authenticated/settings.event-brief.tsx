import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TemplateManager } from "@/components/template-manager";
import { useCompanySettings } from "@/components/settings-shared";
import { BRIEF_PLACEHOLDERS } from "@/lib/brief-template";

export const Route = createFileRoute("/_authenticated/settings/event-brief")({
  component: EventBriefSettings,
});

function EventBriefSettings() {
  const { company, loading } = useCompanySettings();
  const [mode, setMode] = useState<"platform" | "template">("platform");
  const [hasTemplate, setHasTemplate] = useState(true);

  useEffect(() => {
    if (!company) return;
    setMode((company.brief_mode as "platform" | "template") ?? "platform");
    supabase
      .from("event_brief_templates" as any)
      .select("id")
      .eq("company_id", company.id)
      .limit(1)
      .then(({ data }) => setHasTemplate(((data as any[]) ?? []).length > 0));
  }, [company]);

  async function setBriefMode(next: "platform" | "template") {
    if (!company) return;
    setMode(next);
    const { error } = await supabase
      .from("companies")
      .update({ brief_mode: next } as any)
      .eq("id", company.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  if (loading || !company)
    return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Event brief / BEO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>How briefs are generated</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setBriefMode("platform")}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                mode === "platform" ? "border-primary bg-muted/50" : "hover:bg-muted/30"
              }`}
            >
              <div className="font-medium">Use EventFlow brief</div>
              <p className="mt-1 text-xs text-muted-foreground">
                The built-in brief layout with overview, contacts, timings, F&amp;B, extras and
                run-of-show blanks.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setBriefMode("template")}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                mode === "template" ? "border-primary bg-muted/50" : "hover:bg-muted/30"
              }`}
            >
              <div className="font-medium">Use my own template</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Your BEO template is filled with the deal's details. Still editable after
                generation.
              </p>
            </button>
          </div>
          {mode === "template" && !hasTemplate && (
            <div className="rounded-md border border-amber-500/40 bg-amber-50 p-2 text-xs dark:bg-amber-950/20">
              No BEO template yet — briefs fall back to the EventFlow brief until you add one and
              mark it as default.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>BEO templates</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateManager
            companyId={company.id}
            table="event_brief_templates"
            namePlaceholder="Banquet Event Order"
            placeholders={BRIEF_PLACEHOLDERS}
            description="Your own BEO / event brief layouts. The default template is used when brief generation is set to 'my own template'."
            helpText="Insert placeholders from the toolbar dropdown — they're filled from the deal when a brief is generated."
          />
        </CardContent>
      </Card>
    </div>
  );
}
