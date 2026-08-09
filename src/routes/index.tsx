import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuthUser } from "@/lib/auth-hooks";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Sparkles, Users } from "lucide-react";
import { APP_NAME, APP_TITLE, APP_DESCRIPTION } from "@/lib/app-brand";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: APP_TITLE },
      { name: "description", content: APP_DESCRIPTION },
      { property: "og:title", content: APP_TITLE },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://eventflow-pro-45.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://eventflow-pro-45.lovable.app/" }],
  }),
});


function Index() {
  const { user, loading } = useAuthUser();
  if (loading) return null;
  if (user) return <Navigate to="/deals" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <img
            src="/eventeer-logo.svg"
            alt={`${APP_NAME} logo`}
            className="h-8 w-auto sm:h-9"
            width={376}
            height={96}
          />
          <Link to="/auth">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight">
            Event proposals, from inquiry to signed.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Build personalised proposals in minutes. Let clients configure their event through a
            branded magic link. Track every deal in one pipeline.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth">
              <Button size="lg">Get started free</Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-6 md:grid-cols-3">
          <Feature
            icon={<Sparkles className="h-5 w-5" />}
            title="Smart pricing engine"
            body="Seasons, day-of-week minimums, per-guest thresholds and auto service/tax."
          />
          <Feature
            icon={<Users className="h-5 w-5" />}
            title="Client-configurable"
            body="Send a proposal via magic link. Client picks packages within the limits you set."
          />
          <Feature
            icon={<CalendarCheck className="h-5 w-5" />}
            title="Shared deal dashboard"
            body="One pipeline view. Share stakeholder-friendly read-only links."
          />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border p-6">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
