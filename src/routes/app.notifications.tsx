import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { NOTIFICATIONS } from "@/lib/mock-data";

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
  return (
    <div>
      <PageHeader title="Notifications" description="4 unread alerts across your network" />
      <div className="card-elevated divide-y divide-border p-2">
        {NOTIFICATIONS.map((n) => {
          const Icon = ICONS[n.kind as keyof typeof ICONS];
          return (
            <div key={n.title} className="flex gap-4 rounded-xl p-4 transition-colors hover:bg-muted/40">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[n.kind as keyof typeof TONES]}`}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.when}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
