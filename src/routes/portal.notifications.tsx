import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, BellRing, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchMyNotifications,
  formatNotificationWhen,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Customer portal" },
      { name: "description", content: "Parcel status alerts, payment receipts and collection reminders." },
      { property: "og:title", content: "Notifications" },
      { property: "og:description", content: "Parcel alerts and payment receipts." },
    ],
  }),
  component: PortalNotifications,
});

const ICONS = {
  success: CheckCircle2,
  destructive: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
} as const;

const TONES = {
  success: "bg-success/12 text-success",
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-warning/15 text-warning-foreground",
  info: "bg-info/10 text-info",
} as const;

function PortalNotifications() {
  const { isAuthenticated, isLoading: authLoading, isDemoMode } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (authLoading) return;
    if (!isSupabaseConfigured() || isDemoMode || !isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchMyNotifications();
    setItems(rows);
    setLoading(false);
  }, [authLoading, isAuthenticated, isDemoMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unread = items.filter((n) => !n.readAt).length;

  if (authLoading || loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated && !isDemoMode) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="flex items-center justify-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-bold">Notifications</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to see status alerts and collection reminders for your parcels.
        </p>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/portal/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-bold">Notifications</h1>
        </div>
        {unread > 0 ? (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={async () => {
              await markAllNotificationsRead();
              toast.success("All notifications marked read");
              void refresh();
            }}
          >
            Mark all read
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {unread
          ? `${unread} unread`
          : items.length
            ? "You're all caught up"
            : "No alerts yet — they appear when your parcels move."}
      </p>

      {items.length === 0 ? (
        <div className="card-elevated mt-6 p-10 text-center text-sm text-muted-foreground">
          No notifications yet.
        </div>
      ) : (
        <div className="card-elevated mt-6 divide-y divide-border p-2">
          {items.map((n) => {
            const Icon = ICONS[n.kind];
            return (
              <button
                key={n.id}
                type="button"
                className="flex w-full gap-4 rounded-xl p-4 text-left transition-colors hover:bg-muted/40"
                onClick={() => {
                  if (!n.readAt) {
                    void markNotificationRead(n.id).then(() =>
                      setItems((prev) =>
                        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
                      ),
                    );
                  }
                }}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[n.kind]}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${n.readAt ? "" : "text-foreground"}`}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatNotificationWhen(n.createdAt)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
