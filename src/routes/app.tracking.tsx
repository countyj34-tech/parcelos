import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/tracking")({
  head: () => ({ meta: [{ title: "Tracking — ParcelOS" }] }),
  component: TrackingAdmin,
});

const STATUSES = [
  "Waiting for Drop-off",
  "Received",
  "Dispatched",
  "In Transit",
  "Arrived",
  "Ready for Collection",
  "Collected",
  "Delay",
  "Returned",
  "Lost",
];

function TrackingAdmin() {
  const [active, setActive] = useState(3);

  return (
    <div className="space-y-6">
      <PageHeader title="Tracking" description="Update parcel status and timeline" actions={<Button className="rounded-xl">Save changes</Button>} />

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input defaultValue="POS-249071-ZM" className="h-11 rounded-xl pl-9" />
        </div>
        <Button variant="outline" className="h-11 rounded-xl">Load</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Timeline editor</h2>
          <div className="mt-4 space-y-2">
            {STATUSES.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                  active === i ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/50",
                )}
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">{STATUSES[active]}</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Timestamp</Label>
              <Input defaultValue="12 Mar 2026, 15:05" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input defaultValue="Lusaka — Cairo Road" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Staff member</Label>
              <Input defaultValue="Joseph Kunda" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes…" className="min-h-24 rounded-xl" />
            </div>
            <Button className="w-full rounded-xl">Update status</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
