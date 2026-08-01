import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuthUser } from "@/lib/auth-hooks";
import { acceptInvites } from "@/lib/team.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accept team invitation | EventFlow" },
      {
        name: "description",
        content: "Accept your invitation and join your team's event workspace.",
      },
      { property: "og:title", content: "Accept team invitation | EventFlow" },
      {
        property: "og:description",
        content: "Accept your invitation and join your team's event workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useParams();
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvites);
  const [state, setState] = useState<"working" | "failed">("working");

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        const res = await accept({ data: { token } });
        if (res.accepted > 0) {
          toast.success("Invitation accepted");
          await navigate({ to: "/deals" });
        } else {
          setState("failed");
        }
      } catch {
        setState("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, token]);

  if (loading) return null;
  if (!user) {
    return <Navigate to="/auth" search={{ next: `/invite/${token}` }} />;
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {state === "working" ? "Accepting invitation…" : "Invitation not available"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {state === "working"
            ? "One moment while we add you to the team."
            : "This invitation may have expired, been revoked, or was sent to a different email address. Ask an admin to send a new one."}
        </CardContent>
      </Card>
    </div>
  );
}
