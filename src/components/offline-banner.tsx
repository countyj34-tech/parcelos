import { useEffect, useState } from "react";
import { isBrowserOffline } from "@/lib/offline";

/** Small banner so staff know the desk is open but not syncing. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(() => isBrowserOffline());

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      No internet — the app is still open. Parcel lists and GPS will sync when data returns.
    </div>
  );
}
