import { createFileRoute } from "@tanstack/react-router";
import { QrCode, ScanLine, Truck, User } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusPill } from "@/components/status-pill";
import { DISPATCH_RUN, PARCELS } from "@/lib/mock-data";

export const Route = createFileRoute("/app/dispatch")({
  head: () => ({ meta: [{ title: "Dispatch — ParcelOS" }] }),
  component: DispatchPage,
});

const VEHICLES = [
  { id: "v1", vehicle: "Toyota Hiace • ABZ 4417", driver: "Joseph Kunda", route: "Lusaka → Ndola", capacity: 60, loaded: 38 },
  { id: "v2", vehicle: "Isuzu NPR • ABL 2291", driver: "Peter Banda", route: "Chipata → Ndola", capacity: 80, loaded: 52 },
  { id: "v3", vehicle: "Mercedes Sprinter • ACB 8812", driver: "Grace Mwila", route: "Nairobi → Kampala", capacity: 45, loaded: 0 },
];

function DispatchPage() {
  const run = DISPATCH_RUN;

  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch" description="Load vehicles and send parcels on the road" actions={<Button className="rounded-xl"><Truck className="mr-2 h-4 w-4" /> New dispatch</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vehicles ready" value={3} icon={Truck} />
        <StatCard label="Drivers ready" value={4} icon={User} />
        <StatCard label="Pending dispatch" value={67} icon={ScanLine} accent="#F59E0B" />
        <StatCard label="Dispatched today" value={9} icon={Truck} accent="#10B981" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {VEHICLES.map((v) => (
          <div key={v.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="font-semibold">{v.vehicle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{v.route}</p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              {v.driver}
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{v.loaded} / {v.capacity} parcels</span>
                <span>{Math.round((v.loaded / v.capacity) * 100)}%</span>
              </div>
              <Progress value={(v.loaded / v.capacity) * 100} className="mt-2 h-2" />
            </div>
            <Button className="mt-4 w-full rounded-xl" variant={v.loaded > 0 ? "default" : "outline"}>
              {v.loaded > 0 ? "Dispatch now" : "Start loading"}
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Parcel loading</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <ScanLine className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Barcode scanner</p>
              <Input placeholder="Scan barcode…" className="mt-3 h-11 rounded-xl" />
            </div>
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <QrCode className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">QR scanner</p>
              <Input placeholder="Scan QR…" className="mt-3 h-11 rounded-xl" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl">Load parcel</Button>
            <Button variant="outline" className="rounded-xl">Unload parcel</Button>
            <Button variant="outline" className="rounded-xl">Transfer parcel</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Active run · {run.code}</h2>
          <p className="text-sm text-muted-foreground">{run.route}</p>
          <div className="mt-4 space-y-2">
            {PARCELS.slice(0, 4).map((p) => (
              <div key={p.tracking} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Checkbox defaultChecked />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.tracking}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.destination}</p>
                </div>
                <StatusPill status={p.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
