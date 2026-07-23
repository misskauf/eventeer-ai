import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listMyNotifications,
  markNotificationsRead,
  getUnreadCount,
} from "@/lib/notifications.functions";

type Notif = {
  id: string;
  deal_id: string | null;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listMyNotifications);
  const unread = useServerFn(getUnreadCount);
  const markRead = useServerFn(markNotificationsRead);

  const notifQuery = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => list({ data: { limit: 20 } }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const unreadQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => unread(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const mark = useMutation({
    mutationFn: (vars: { ids?: string[]; all?: boolean }) => markRead({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items: Notif[] = (notifQuery.data?.notifications ?? []) as Notif[];
  const count = unreadQuery.data?.count ?? 0;

  async function onItemClick(n: Notif) {
    if (!n.read_at) mark.mutate({ ids: [n.id] });
    if (n.deal_id) {
      await navigate({ to: "/deals/$id", params: { id: n.deal_id } });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
            >
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold">Notifications</div>
          {count > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => mark.mutate({ all: true })}
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => onItemClick(n)}
                className={
                  "block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-accent/60 " +
                  (n.read_at ? "" : "bg-accent/30")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={
                      "text-sm " + (n.read_at ? "font-normal" : "font-semibold")
                    }
                  >
                    {n.title}
                  </div>
                  <div className="whitespace-nowrap text-[10px] text-muted-foreground">
                    {relativeTime(n.created_at)}
                  </div>
                </div>
                {n.body && (
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {n.body}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
