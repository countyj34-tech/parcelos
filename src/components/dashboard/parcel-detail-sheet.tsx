import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { ParcelTimeline } from "@/components/portal/parcel-timeline";
import {
  Clock,
  Handshake,
  MapPin,
  PackageCheck,
  PackageSearch,
  Truck,
  Warehouse,
} from "lucide-react";
import type { Parcel } from "@/lib/types/parcel";
import { money } from "@/lib/money";
import { fetchStaffTrackingEvents } from "@/lib/api/tracking";

const TIMELINE_ICONS = [Clock, PackageCheck, Warehouse, Truck, MapPin, PackageSearch, Handshake];

type ParcelDetailSheetProps = {
  parcel: Parcel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ParcelDetailSheet({ parcel, open, onOpenChange }: ParcelDetailSheetProps) {
  const [events, setEvents] = useState<Array<{ title: string; description: string | null; occurred_at: string; status: string }>>([]);

  useEffect(() => {
    if (!open || !parcel?.tracking) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    void fetchStaffTrackingEvents(parcel.tracking).then((rows) => {
      if (!cancelled) setEvents(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, parcel?.tracking]);

  if (!parcel) return null;

  const timeline = events.length
    ? events.map((ev, i) => ({
        label: ev.title,
        icon: TIMELINE_ICONS[Math.min(i, TIMELINE_ICONS.length - 1)]!,
        time: formatWhen(ev.occurred_at),
        detail: ev.description || parcel.destination,
      }))
    : [
        { label: "Waiting for Drop-off", icon: TIMELINE_ICONS[0]!, time: parcel.created, detail: `Registered at ${parcel.branch}` },
        { label: parcel.status, icon: TIMELINE_ICONS[1]!, time: "Latest", detail: parcel.destination },
      ];

  const collectDesk = parcel.status === "Ready for Collection" || parcel.status === "Arrived";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{parcel.tracking}</SheetTitle>
          <StatusPill status={parcel.status} className="w-fit" />
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" className="rounded-xl">
            <Link to="/app/reception" search={{ q: parcel.tracking, desk: collectDesk ? "collect" : "dropoff" }}>
              {collectDesk ? "Collect at counter" : "Open at reception"}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-xl">
            <Link to="/app/tracking">Update tracking</Link>
          </Button>
        </div>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <Section title="Sender" rows={[["Name", parcel.sender], ["Phone", parcel.senderPhone]]} />
            <Section title="Receiver" rows={[["Name", parcel.receiver], ["Phone", parcel.receiverPhone], ["Destination", parcel.destination]]} />
            <Section title="Payment" rows={[["Status", parcel.payment], ["Amount", money(parcel.amount)], ["Branch", parcel.branch]]} />
            <Section title="Parcel" rows={[["Category", parcel.category], ["Weight", parcel.weight], ["Declared value", money(parcel.declaredValue)]]} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <ParcelTimeline steps={timeline} currentIndex={Math.max(timeline.length - 1, 0)} />
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <ul className="space-y-3 text-sm">
              {(events.length ? events : [{ title: "Parcel created", description: null, occurred_at: parcel.created, status: "" }]).map((ev, i) => (
                <li key={`${ev.occurred_at}-${i}`} className="rounded-xl border border-border p-3">
                  <p className="font-medium">{ev.title}</p>
                  {ev.description ? <p className="text-sm text-muted-foreground">{ev.description}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatWhen(ev.occurred_at)}</p>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Section({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <dl className="mt-3 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
