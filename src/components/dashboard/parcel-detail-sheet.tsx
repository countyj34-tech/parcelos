import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const TIMELINE_ICONS = [Clock, PackageCheck, Warehouse, Truck, MapPin, PackageSearch, Handshake];

type ParcelDetailSheetProps = {
  parcel: Parcel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ParcelDetailSheet({ parcel, open, onOpenChange }: ParcelDetailSheetProps) {
  if (!parcel) return null;

  const timeline = [
    { label: "Waiting for Drop-off", icon: TIMELINE_ICONS[0]!, time: parcel.created, detail: `Registered at ${parcel.branch}` },
    { label: parcel.status, icon: TIMELINE_ICONS[1]!, time: "Latest update", detail: parcel.destination },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{parcel.tracking}</SheetTitle>
          <StatusPill status={parcel.status} className="w-fit" />
        </SheetHeader>

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
            <ParcelTimeline steps={timeline} currentIndex={1} />
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <ul className="space-y-3 text-sm">
              <li className="rounded-xl border border-border p-3">
                <p className="font-medium">Parcel created</p>
                <p className="text-xs text-muted-foreground">{parcel.created}</p>
              </li>
            </ul>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
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
