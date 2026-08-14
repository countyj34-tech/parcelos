import type { PlatformCompany } from "@/lib/platform-data";

export type LifecycleStatus =
  | "Active"
  | "Trial"
  | "Expired"
  | "Suspended"
  | "Past due"
  | "Paused"
  | "Disconnected";

type Override = {
  status: LifecycleStatus;
  reason?: string;
  updatedAt: string;
};

const STORAGE_KEY = "parcelos-company-lifecycle";
const EVENT = "parcelos-company-lifecycle";

const BLOCKED: ReadonlySet<string> = new Set([
  "Paused",
  "Suspended",
  "Disconnected",
  "Expired",
]);

function readAll(): Record<string, Override> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Override>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, Override>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeCompanyLifecycle(cb: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Stable snapshot for useSyncExternalStore — never return Date.now() or a new object. */
export function getCompanyLifecycleSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function getLifecycleOverride(slug: string): Override | null {
  return readAll()[slug] ?? null;
}

export function getEffectiveCompanyStatus(
  slug: string,
  fallback: LifecycleStatus | string,
): LifecycleStatus | string {
  return getLifecycleOverride(slug)?.status ?? fallback;
}

export function isCompanyAccessBlocked(status: string): boolean {
  return BLOCKED.has(status);
}

export function setCompanyLifecycleStatus(
  slug: string,
  status: LifecycleStatus,
  reason?: string,
) {
  const map = readAll();
  map[slug] = {
    status,
    ...(reason ? { reason } : {}),
    updatedAt: new Date().toISOString(),
  };
  writeAll(map);
}

export function clearCompanyLifecycleStatus(slug: string) {
  const map = readAll();
  delete map[slug];
  writeAll(map);
}

/** Soft-delete marker — company hidden from list but recoverable via storage clear. */
export function softDeleteCompany(slug: string) {
  setCompanyLifecycleStatus(slug, "Disconnected", "Deleted by platform owner");
}

export function applyLifecycleOverrides(companies: PlatformCompany[]): PlatformCompany[] {
  const map = readAll();
  return companies.map((c) => {
    const o = map[c.slug];
    if (!o) return c;
    return { ...c, status: o.status as PlatformCompany["status"] };
  });
}

export function lifecycleEventName() {
  return EVENT;
}
