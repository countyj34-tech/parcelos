import { useState } from "react";
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

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track your parcel — ParcelOS" },
      { name: "description", content: "Track your parcel from drop-off to collection." },
    ],
  }),
  component: TrackPage,
});

const TIMELINE = [
  { label: "Waiting for Drop-off", icon: Clock, time: "11 Mar 2026 · 18:42", detail: "Reference created online by Chanda Mulenga." },
  { label: "Received", icon: PackageCheck, time: "12 Mar 2026 · 08:14", detail: "Verified and paid at Lusaka — Cairo Road." },
  { label: "Dispatched", icon: Warehouse, time: "12 Mar 2026 · 13:30", detail: "Loaded onto run LSK-RUN-041." },
  { label: "In Transit", icon: Truck, time: "12 Mar 2026 · 15:05", detail: "En route to Ndola — Broadway." },
  { label: "Arrived", icon: MapPin, time: "Expected · 19:40", detail: "Ndola — Broadway branch." },
  { label: "Ready for Collection", icon: PackageSearch, time: "Pending", detail: "Receiver will be notified." },
  { label: "Collected", icon: Handshake, time: "Pending", detail: "ID verification at counter." },
];

function TrackPage() {
  const [query, setQuery] = useState("POS-249071-ZM");
  const [shown, setShown] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="hero-glow border-b border-border">
        <FadeIn className="mx-auto max-w-2xl px-5 py-20 text-center lg:py-24">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Track your parcel</h1>
          <p className="mt-4 text-lg text-muted-foreground">Enter your reference number below.</p>
          <form
            className="mx-auto mt-10 max-w-xl space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setShown(true);
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
            <Button type="submit" className="h-14 w-full rounded-2xl text-base">
              Track
            </Button>
          </form>
        </FadeIn>
      </section>

      {shown ? (
        <section className="mx-auto max-w-2xl px-5 py-14">
          <div className="card-elevated p-6 sm:p-8">
            <div className="border-b border-border pb-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tracking number</p>
              <p className="mt-1 font-display text-2xl font-bold">{query || "POS-249071-ZM"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Cairo Road → Ndola · 3.2 kg · Electronics</p>
              <StatusPill status="In Transit" className="mt-3" />
            </div>
            <ParcelTimeline steps={TIMELINE} currentIndex={3} className="mt-8" />
          </div>
        </section>
      ) : null}

      <SiteFooter />
    </div>
  );
}
