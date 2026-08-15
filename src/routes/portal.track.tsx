import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clock,
  Handshake,
  MapPin,
  PackageCheck,
  PackageSearch,
  Search,
  Truck,
  Warehouse,
} from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { ParcelTimeline } from "@/components/portal/parcel-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import { trackParcelPublic, fetchParcelTrackingEvents } from "@/lib/api/parcels";
import { formatParcelStatus } from "@/lib/api/mappers";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/track")({
  validateSearch: (search: Record<string, unknown>) => {
    const q = typeof search["q"] === "string" ? search["q"] : undefined;
    return q ? { q } : {};
  },
  head: () => ({
    meta: [{ title: "Track parcel" }],
  }),
  component: PortalTrack,
});

const FLOW_STEPS = [
  { code: "waiting_for_dropoff", label: "Waiting for Drop-off", icon: Clock, detail: "Reference created — bring the parcel to the branch." },
  { code: "received", label: "Received", icon: PackageCheck, detail: "Verified and weighed at origin branch." },
  { code: "dispatched", label: "Dispatched", icon: Warehouse, detail: "Loaded for the outbound run." },
  { code: "in_transit", label: "In Transit", icon: Truck, detail: "En route to destination branch." },
  { code: "at_destination_branch", label: "Arrived", icon: MapPin, detail: "At destination branch." },
  { code: "ready_for_collection", label: "Ready for Collection", icon: PackageSearch, detail: "Receiver can collect with ID." },
  { code: "collected", label: "Collected", icon: Handshake, detail: "Handed over to the receiver." },
] as const;

function statusIndex(status: string): number {
  const normalized = status.toLowerCase();
  if (normalized === "reception_verification" || normalized === "awaiting_payment" || normalized === "label_printed") {
    return 1;
  }
  const idx = FLOW_STEPS.findIndex((s) => s.code === normalized);
  return idx >= 0 ? idx : 0;
}

function PortalTrack() {
  const { q: initialQ } = Route.useSearch();
  const [query, setQuery] = useState(initialQ ?? "");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<{
    tracking: string;
    status: string;
    origin: string;
    destination: string;
    company: string;
    updatedAt: string;
    live: boolean;
    events: Array<{ title: string; description: string | null; occurred_at: string; status: string }>;
  } | null>(null);

  const timeline = useMemo(() => {
    if (!result) return [];
    if (result.events.length) {
      return result.events.map((ev) => ({
        label: ev.title || formatParcelStatus(ev.status),
        icon: Clock,
        time: formatUpdated(ev.occurred_at),
        detail: ev.description || `${result.origin} → ${result.destination}`,
      }));
    }
    const idx = statusIndex(result.status);
    return FLOW_STEPS.map((step, i) => ({
      label: step.label,
      icon: step.icon,
      time: i < idx ? "Done" : i === idx ? formatUpdated(result.updatedAt) : "Pending",
      detail:
        i === idx
          ? `${result.origin} → ${result.destination}`
          : i < idx
            ? "Completed"
            : step.detail,
    }));
  }, [result]);

  const currentIndex = result
    ? result.events.length
      ? Math.max(result.events.length - 1, 0)
      : statusIndex(result.status)
    : 0;
  const uiStatus = result ? formatParcelStatus(result.status) : "In Transit";

  const runTrack = async (trackingRaw: string, silent = false) => {
    const tracking = trackingRaw.trim();
    if (!tracking) {
      if (!silent) toast.error("Enter a tracking number");
      return;
    }

    if (!silent) {
      setLoading(true);
      setSearched(true);
    }

    if (!isSupabaseConfigured()) {
      if (!silent) {
        setResult(null);
        toast.error("Tracking is unavailable", { description: "Connect the app to Supabase for live tracking." });
        setLoading(false);
      }
      return;
    }

    const row = await trackParcelPublic(tracking);
    if (row) {
      const events = await fetchParcelTrackingEvents(row.tracking_number);
      setResult({
        tracking: row.tracking_number,
        status: row.status,
        origin: row.origin_branch ?? "—",
        destination: row.destination_branch ?? "—",
        company: row.company_name,
        updatedAt: row.updated_at,
        live: true,
        events: events as Array<{ title: string; description: string | null; occurred_at: string; status: string }>,
      });
      setLoading(false);
      return;
    }

    if (!silent) {
      setResult(null);
      toast.message("No parcel found", { description: "Check the reference and try again." });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!result?.tracking) return;
    if (result.status === "collected" || result.status === "cancelled") return;
    const id = window.setInterval(() => {
      void runTrack(result.tracking, true);
    }, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.tracking, result?.status]);

  useEffect(() => {
    if (initialQ?.trim()) {
      void runTrack(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-run when URL q is present on mount
  }, [initialQ]);

  const onTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    await runTrack(query);
  };

  return (
    <FadeIn>
      <Link to="/portal" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <h1 className="mt-6 text-2xl font-bold sm:text-3xl">Track parcel</h1>
      <p className="mt-2 text-muted-foreground">Enter your reference or tracking number.</p>

      <form className="mt-8 space-y-3" onSubmit={(e) => void onTrack(e)}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. POS-249071-ZM"
            className="h-14 rounded-2xl pl-12 text-base"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="h-14 w-full rounded-2xl text-base font-semibold"
          style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
        >
          {loading ? "Searching…" : "Track"}
        </Button>
      </form>

      {searched && result ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="border-b border-border pb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tracking number</p>
            <p className="mt-1 font-display text-xl font-bold">{result.tracking}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.origin} → {result.destination}
              {result.company ? ` · ${result.company}` : ""}
            </p>
            <StatusPill status={uiStatus} className="mt-3" />
          </div>
          <ParcelTimeline steps={timeline} currentIndex={currentIndex} className="mt-6" />
        </div>
      ) : null}

      {searched && !result && !loading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">No parcel matched that reference.</p>
      ) : null}
    </FadeIn>
  );
}

function formatUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
