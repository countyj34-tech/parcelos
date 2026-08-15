import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Navigation } from "lucide-react";
import { reportRunLocationPublic } from "@/lib/api/tracking";

export const Route = createFileRoute("/run/$token")({
  head: () => ({
    meta: [
      { title: "Trip GPS — ParcelOS" },
      { name: "description", content: "Keep this page open in the vehicle to update live tracking." },
    ],
  }),
  component: VanGpsPage,
});

function VanGpsPage() {
  const { token } = Route.useParams();
  const [status, setStatus] = useState("Allow location, then leave this page open in the van.");
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!token || typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This phone cannot share GPS.");
      return;
    }

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 8000) return;
        lastSent.current = now;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setStatus("Sharing GPS… keep this screen on.");
        setError(null);
        void reportRunLocationPublic({
          token,
          lat,
          lng,
          accuracyM: pos.coords.accuracy ?? null,
        })
          .then((rows) => {
            setLast(
              rows[0]?.title
                ? `${rows[0].tracking} — ${rows[0].title}`
                : `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            );
          })
          .catch((err) => setError(err instanceof Error ? err.message : "Could not send location"));
      },
      (geoErr) => {
        setError(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? "Allow location for this site, then refresh."
            : "Could not read GPS. Keep location on.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watch);
  }, [token]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        {error ? <Loader2 className="h-6 w-6" /> : <Navigation className="h-6 w-6" />}
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Van GPS</h1>
      <p className="mt-2 text-sm text-muted-foreground">{status}</p>
      {last ? <p className="mt-4 text-sm font-medium">{last}</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <p className="mt-8 text-xs text-muted-foreground">
        No login needed. Driver keeps this page open until they reach the collect office.
      </p>
    </div>
  );
}
