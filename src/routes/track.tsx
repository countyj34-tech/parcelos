import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { ParcelTimeline } from "@/components/portal/parcel-timeline";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import {
  Clock,
  Handshake,
  MapPin,
  PackageCheck,
  PackageSearch,
  Truck,
  Warehouse,
} from "lucide-react";
import { trackParcelPublic, fetchParcelTrackingEvents } from "@/lib/api/parcels";
import { formatParcelStatus } from "@/lib/api/mappers";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toast } from "sonner";

export const Route = createFileRoute("/track")({
  validateSearch: (search: Record<string, unknown>) => {
    const q = typeof search["q"] === "string" ? search["q"] : undefined;
    return q ? { q } : {};
  },
  head: () => ({
    meta: [
      { title: "Track your parcel — ParcelOS" },
      { name: "description", content: "Track your parcel from drop-off to collection." },
    ],
  }),
  component: TrackPage,
});

const FLOW_STEPS = [
  { code: "waiting_for_dropoff", label: "Waiting for Drop-off", icon: Clock, detail: "Reference created — bring the parcel to the branch." },
  { code: "received", label: "Received", icon: PackageCheck, detail: "Verified and weighed at origin branch." },
  { code: "dispatched", label: "Dispatched", icon: Warehouse, detail: "Loaded for the outbound run." },
  { code: "in_transit", label: "In Transit", icon: Truck, detail: "En route to the destination office." },
  { code: "at_destination_branch", label: "Arrived", icon: MapPin, detail: "At destination branch." },
  { code: "ready_for_collection", label: "Ready for Collection", icon: PackageSearch, detail: "Bring ID to collect." },
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

function TrackPage() {
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
    events: Array<{ title: string; description: string | null; occurred_at: string; status: string }>;
  } | null>(null);

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
        toast.error("Tracking is unavailable");
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
        events: events as Array<{ title: string; description: string | null; occurred_at: string; status: string }>,
      });
      setLoading(false);
      return;
    }
    if (!silent) {
      setResult(null);
      toast.message("No parcel found");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (initialQ?.trim()) void runTrack(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  useEffect(() => {
    if (!result?.tracking || result.status === "collected") return;
    const id = window.setInterval(() => void runTrack(result.tracking, true), 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.tracking, result?.status]);

  const timeline = useMemo(() => {
    if (!result) return [];
    if (result.events.length) {
      return result.events.map((ev) => ({
        label: ev.title || formatParcelStatus(ev.status),
        icon: Clock,
        time: formatWhen(ev.occurred_at),
        detail: ev.description || `${result.origin} → ${result.destination}`,
      }));
    }
    const idx = statusIndex(result.status);
    return FLOW_STEPS.map((step, i) => ({
      label: step.label,
      icon: step.icon,
      time: i < idx ? "Done" : i === idx ? formatWhen(result.updatedAt) : "Pending",
      detail: i <= idx ? `${result.origin} → ${result.destination}` : step.detail,
    }));
  }, [result]);

  const currentIndex = result
    ? result.events.length
      ? Math.max(result.events.length - 1, 0)
      : statusIndex(result.status)
    : 0;
  const uiStatus = result ? formatParcelStatus(result.status) : "In Transit";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="hero-glow border-b border-border">
        <FadeIn className="mx-auto max-w-2xl px-5 py-20 text-center lg:py-24">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Track your parcel</h1>
          <p className="mt-4 text-lg text-muted-foreground">Live status from the courier office — not a sample timeline.</p>
          <form
            className="mx-auto mt-10 max-w-xl space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void runTrack(query);
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. POS-249071-ZM"
                className="h-14 rounded-2xl pl-12 text-base"
              />
            </div>
            <Button type="submit" className="h-14 w-full rounded-2xl text-base" disabled={loading}>
              {loading ? "Searching…" : "Track"}
            </Button>
          </form>
        </FadeIn>
      </section>

      {searched && result ? (
        <section className="mx-auto max-w-2xl px-5 py-14">
          <div className="card-elevated p-6 sm:p-8">
            <div className="border-b border-border pb-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tracking number</p>
              <p className="mt-1 font-display text-2xl font-bold">{result.tracking}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.origin} → {result.destination}
                {result.company ? ` · ${result.company}` : ""}
              </p>
              <StatusPill status={uiStatus} className="mt-3" />
            </div>
            <ParcelTimeline steps={timeline} currentIndex={currentIndex} className="mt-8" />
          </div>
        </section>
      ) : null}

      {searched && !result && !loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No parcel matched that reference.</p>
      ) : null}

      <SiteFooter />
    </div>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
