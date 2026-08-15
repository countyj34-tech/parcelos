import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, MapPin, Navigation, Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/hooks/use-auth";
import { useLiveRun } from "@/hooks/use-live-run";
import { useParcels } from "@/hooks/use-parcels";
import { useWorkspaceBranch } from "@/hooks/use-workspace-branch";
import { fetchStaffTrackingEvents, searchParcelForTracking, TRACKING_STATUSES, updateParcelTrackingStatus } from "@/lib/api/tracking";
import type { Parcel } from "@/lib/types/parcel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tracking")({
  validateSearch: (s: Record<string, unknown>) => {
    const q = typeof s["q"] === "string" ? s["q"] : undefined;
    return q ? { q } : {};
  },
  head: () => ({ meta: [{ title: "Tracking — ParcelOS" }] }),
  component: TrackingAdmin,
});

function TrackingAdmin() {
  const { q: qParam } = Route.useSearch();
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const office = useWorkspaceBranch();
  const { data: liveParcels = [] } = useParcels({
    branch: office.isAll ? undefined : office.branchName ?? undefined,
    branchId: office.isAll ? undefined : office.branchId ?? undefined,
    branchScope: "involved",
  });
  const onRoad = liveParcels.filter((p) =>
    ["Received", "Dispatched", "In Transit", "Arrived", "Ready for Collection"].includes(p.status),
  );
  const [query, setQuery] = useState(qParam ?? "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [events, setEvents] = useState<Array<{ title: string; description: string | null; occurred_at: string; status: string }>>([]);
  const [active, setActive] = useState("In Transit");
  const [note, setNote] = useState("");
  const [notifyReceiver, setNotifyReceiver] = useState(true);
  const live = useLiveRun(companyId);

  const lastEvent = events[events.length - 1];

  const load = async (trackingRaw?: string) => {
    const tracking = (trackingRaw ?? query).trim();
    if (!tracking) {
      toast.error("Enter a tracking number");
      return;
    }
    setLoading(true);
    try {
      const row = await searchParcelForTracking(tracking);
      if (!row) {
        setParcel(null);
        setEvents([]);
        toast.message("No parcel found");
        return;
      }
      const timeline = await fetchStaffTrackingEvents(row.tracking);
      setQuery(row.tracking);
      setParcel(row);
      setEvents(timeline);
      setActive(row.status);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load parcel");
    } finally {
      setLoading(false);
    }
  };

  const onUpdate = async (statusLabel?: string) => {
    const next = statusLabel ?? active;
    if (statusLabel) setActive(statusLabel);
    if (!parcel?.id) {
      toast.error("Load a parcel first — search the tracking number, then Update.");
      return;
    }
    if (!companyId) {
      toast.error("Sign in as company staff to save tracking.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateParcelTrackingStatus({
        parcelId: parcel.id,
        companyId,
        uiStatus: next,
        note,
        notifyReceiver,
      });
      toast.success(`Updated to ${result.title}`);
      await load(parcel.tracking);
      void queryClient.invalidateQueries({ queryKey: ["parcels"] });
      void queryClient.invalidateQueries({ queryKey: ["company-dashboard"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (qParam?.trim()) void load(qParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam]);

  const timelineHint = useMemo(() => {
    if (!parcel) return "Search a tracking number to edit the live timeline.";
    return `${parcel.origin} → ${parcel.destination}`;
  }, [parcel]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking"
        description="Real status updates — GPS, city arrival, and office check-in"
        actions={
          <Button className="rounded-xl" disabled={saving} onClick={() => void onUpdate()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Live trip GPS</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Keep this phone in the vehicle. When the car moves, parcels go In Transit. Entering a city (Ndola, Kitwe…)
              posts that on the public timeline. At the destination office they flip to Arrived, then Ready for Collection
              — and the receiver is notified.
            </p>
          </div>
          {live.running ? (
            <Button variant="destructive" className="rounded-xl" disabled={live.busy} onClick={() => void live.stop()}>
              Stop trip
            </Button>
          ) : (
            <Button className="rounded-xl" disabled={live.busy || !companyId} onClick={() => void live.start()}>
              {live.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
              Start live trip
            </Button>
          )}
        </div>
        {live.running && live.fix ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sharing {live.fix.lat.toFixed(5)}, {live.fix.lng.toFixed(5)}
            {live.fix.accuracy != null ? ` · ±${Math.round(live.fix.accuracy)}m` : ""}
          </p>
        ) : null}
        {live.error ? <p className="mt-2 text-sm text-destructive">{live.error}</p> : null}
        {live.updates.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {live.updates.slice(0, 5).map((u) => (
              <li key={`${u.parcel_id}-${u.title}`} className="text-muted-foreground">
                <span className="font-medium text-foreground">{u.tracking}</span> — {u.title}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void load())}
            placeholder="POS-249071-ZM"
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <Button variant="outline" className="h-11 rounded-xl" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
        </Button>
      </div>

      {!parcel && onRoad.length ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Parcels in motion — tap to update</p>
          <ul className="space-y-2">
            {onRoad.slice(0, 10).map((p) => (
              <li key={p.id ?? p.tracking}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-muted/40"
                  onClick={() => void load(p.tracking)}
                >
                  <span>
                    <span className="font-semibold">{p.tracking}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {p.origin} → {p.destination}
                    </span>
                  </span>
                  <StatusPill status={p.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parcel ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-card">
          <StatusPill status={parcel.status} />
          <span className="font-semibold">{parcel.tracking}</span>
          <span className="text-muted-foreground">{timelineHint}</span>
          <span className="text-muted-foreground">To {parcel.receiver}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">{timelineHint}</p>
          {events.length ? (
            <ol className="mt-4 space-y-3">
              {events.map((ev, i) => (
                <li key={`${ev.occurred_at}-${i}`} className="flex gap-3 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{formatWhen(ev.occurred_at)}</p>
                    {ev.description ? <p className="mt-0.5 text-muted-foreground">{ev.description}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-4 space-y-2">
              {TRACKING_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void onUpdate(s)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                    active === s ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/50",
                  )}
                >
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {s}
                </button>
              ))}
            </div>
          )}
          {events.length ? (
            <div className="mt-4 space-y-2">
              {TRACKING_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void onUpdate(s)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                    active === s ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/50",
                  )}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">{active}</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Last update</Label>
              <Input
                readOnly
                value={lastEvent ? formatWhen(lastEvent.occurred_at) : parcel?.created ?? "—"}
                className="h-11 rounded-xl bg-muted/40"
              />
            </div>
            <div className="space-y-2">
              <Label>Route</Label>
              <Input readOnly value={parcel ? `${parcel.origin} → ${parcel.destination}` : "—"} className="h-11 rounded-xl bg-muted/40" />
            </div>
            <div className="space-y-2">
              <Label>Receiver</Label>
              <Input readOnly value={parcel ? `${parcel.receiver} · ${parcel.receiverPhone || "no phone"}` : "—"} className="h-11 rounded-xl bg-muted/40" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note on this update…"
                className="min-h-24 rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <Label htmlFor="notify-receiver" className="text-sm font-normal">
                SMS / WhatsApp receiver
              </Label>
              <Switch id="notify-receiver" checked={notifyReceiver} onCheckedChange={setNotifyReceiver} />
            </div>
            <Button className="w-full rounded-xl" disabled={saving} onClick={() => void onUpdate()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update status
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
