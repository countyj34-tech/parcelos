import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchMyNotifications,
  formatNotificationWhen,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications";
import { NOTIFICATIONS } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — ParcelOS" },
      { name: "description", content: "Operational alerts across parcels, payments, dispatch and stock ageing." },
      { property: "og:title", content: "Notifications — ParcelOS" },
      { property: "og:description", content: "Operational alerts for your network." },
    ],
  }),
  component: NotificationsPage,
});

const ICONS = { success: CheckCircle2, destructive: AlertTriangle, warning: AlertTriangle, info: Info } as const;
const TONES = {
  success: "bg-success/12 text-success",
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-warning/15 text-warning-foreground",
  info: "bg-info/10 text-info",
} as const;

function NotificationsPage() {
  const { isDemoMode } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);

  const refresh = useCallback(async () => {
    if (isDemoMode) {
      setItems(
        NOTIFICATIONS.map((n, i) => ({
          id: `demo-${i}`,
          title: n.title,
          body: n.body,
          channel: "in_app",
          status: "delivered",
          readAt: null,
          createdAt: new Date().toISOString(),
          kind: n.kind as AppNotification["kind"],
        })),
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchMyNotifications();
    setItems(rows);
    setLoading(false);
  }, [isDemoMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unread = items.filter((n) => !n.readAt).length;

  const onMarkAll = async () => {
    await markAllNotificationsRead();
    toast.success("All notifications marked read");
    void refresh();
  };

  const onOpen = async (n: AppNotification) => {
    if (!n.readAt && !isDemoMode) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={
          loading
            ? "Loading…"
            : unread
              ? `${unread} unread alert${unread === 1 ? "" : "s"}`
              : items.length
                ? "You're all caught up"
                : "No notifications yet"
        }
        actions={
          !isDemoMode && unread > 0 ? (
            <Button variant="outline" className="rounded-xl" onClick={() => void onMarkAll()}>
              Mark all read
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="card-elevated p-10 text-center text-sm text-muted-foreground">
          No notifications yet. You&apos;ll see parcel, billing, and staff alerts here.
        </div>
      ) : (
        <div className="card-elevated divide-y divide-border p-2">
          {items.map((n) => {
            const Icon = ICONS[n.kind];
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void onOpen(n)}
                className={`flex w-full gap-4 rounded-xl p-4 text-left transition-colors hover:bg-muted/40 ${
                  n.readAt ? "opacity-70" : ""
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[n.kind]}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {!n.readAt ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
                  </div>
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
