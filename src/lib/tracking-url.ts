import { getPublicAppOrigin } from "@/lib/tenant";

export function normalizeTrackingCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function getPublicTrackingPath(code: string): string {
  return `/t/${encodeURIComponent(normalizeTrackingCode(code))}`;
}

/** Link anyone can open in Chrome — no app install, no company login. */
export function getPublicTrackingUrl(code: string, origin?: string): string {
  const base =
    getPublicAppOrigin(origin) ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const path = getPublicTrackingPath(code);
  return base ? `${base}${path}` : path;
}

export function getTrackingWhatsAppUrl(code: string, companyName?: string): string {
  const url = getPublicTrackingUrl(code);
  const text = [
    companyName ? `Track your ${companyName} parcel` : "Track your parcel",
    normalizeTrackingCode(code),
    "",
    "Open this link in any browser (no app install):",
    url,
  ].join("\n");
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
