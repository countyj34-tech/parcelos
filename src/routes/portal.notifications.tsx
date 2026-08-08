import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BellRing, CheckCircle2, Info } from "lucide-react";
import { NOTIFICATIONS } from "@/lib/mock-data";

export const Route = createFileRoute("/portal/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — ParcelOS customer portal" },
      { name: "description", content: "Parcel status alerts, payment receipts and collection reminders." },
      { property: "og:title", content: "Notifications — ParcelOS" },
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
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-2">
        <BellRing className="h-5 w-5 text-primary" />
        <h1 className="text-3xl font-bold">Notifications</h1>
      </div>

      <div className="card-elevated mt-6 divide-y divide-border p-2">
        {NOTIFICATIONS.map((n) => {
          const Icon = ICONS[n.kind as keyof typeof ICONS];
          return (
            <div key={n.title} className="flex gap-4 rounded-xl p-4 transition-colors hover:bg-muted/40">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[n.kind as keyof typeof TONES]}`}
              >
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
