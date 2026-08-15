import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reportRunLocation, startDispatchRun, stopDispatchRun, type TrackingNotify } from "@/lib/api/tracking";

type LiveFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: string;
};

export function useLiveRun(companyId: string | null) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fix, setFix] = useState<LiveFix | null>(null);
  const [updates, setUpdates] = useState<TrackingNotify[]>([]);
  const runIdRef = useRef<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const driverIdRef = useRef<string | null>(null);

  const clearWatch = () => {
    if (watchRef.current != null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  };

  const sendFix = useCallback(
    async (lat: number, lng: number, accuracy: number | null) => {
      if (!companyId) return;
      const now = Date.now();
      if (now - lastSentRef.current < 8000) return;
      lastSentRef.current = now;
      try {
        const rows = await reportRunLocation({
          lat,
          lng,
          companyId,
          driverId: driverIdRef.current,
          accuracyM: accuracy,
          runId: runIdRef.current,
        });
        if (rows.length) {
          setUpdates((prev) => [...rows, ...prev].slice(0, 20));
          void queryClient.invalidateQueries({ queryKey: ["parcels"] });
          void queryClient.invalidateQueries({ queryKey: ["company-dashboard"] });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not report location");
      }
    },
    [companyId, queryClient],
  );

  const start = useCallback(
    async (driverId?: string | null, vehicleId?: string | null) => {
      if (!companyId) {
        setError("Company not loaded");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setError("This device cannot share GPS. Use a phone with location on.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        driverIdRef.current = driverId || null;
        const id = await startDispatchRun(driverId, vehicleId);
        runIdRef.current = id;
        setRunning(true);
        setUpdates([]);
        watchRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const next = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? null,
              at: new Date().toISOString(),
            };
            setFix(next);
            void sendFix(next.lat, next.lng, next.accuracy);
          },
          (geoErr) => {
            setError(
              geoErr.code === geoErr.PERMISSION_DENIED
                ? "Location permission denied. Allow GPS for this site, then start the trip again."
                : "Could not read GPS. Keep the phone in the vehicle with location on.",
            );
          },
          { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 },
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start live trip");
        setRunning(false);
      } finally {
        setBusy(false);
      }
    },
    [companyId, sendFix],
  );

  const stop = useCallback(async () => {
    setBusy(true);
    clearWatch();
    try {
      await stopDispatchRun(runIdRef.current);
    } catch {
      /* still stop locally */
    } finally {
      runIdRef.current = null;
      driverIdRef.current = null;
      setRunning(false);
      setBusy(false);
    }
  }, []);

  useEffect(() => () => clearWatch(), []);

  return { running, busy, error, fix, updates, start, stop };
}
