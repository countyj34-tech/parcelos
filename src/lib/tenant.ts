/** White-label tenant config — maps to Supabase `companies` / `company_settings` in production.
 *  Company owners edit these fields from Settings → Branding / Pricing.
 *  Customers reach a company via `/c/{slug}` (share link / QR). */

export type TenantBranding = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoInitials: string;
  /** Optional uploaded logo. Falls back to initials when empty. */
  logoUrl: string | null;
  primaryColor: string;
  primaryForeground: string;
  accentColor: string;
  supportPhone: string;
  supportEmail: string;
  domain: string;
  trackingDomain: string;
  /** Full-bleed portal / landing background — owner can replace. */
  heroImageUrl: string;
  /**
   * Uploaded price chart image (same idea as the printed chart at the counter).
   * Customers view this for fee ranges; final fee is confirmed at drop-off.
   */
  priceChartUrl: string | null;
};

const STORAGE_KEY = "parcelos-tenant-overrides";
const ACTIVE_SLUG_KEY = "parcelos-active-tenant-slug";

/** Demo tenant: Swift Logistics (swiftlogistics.parcelos.africa) */
export const DEMO_TENANT: TenantBranding = {
  id: "tenant_swift_logistics",
  slug: "swift-logistics",
  name: "Swift Logistics",
  tagline: "Fast. Reliable. Everywhere.",
  logoInitials: "SL",
  logoUrl: null,
  primaryColor: "#0F766E",
  primaryForeground: "#FFFFFF",
  accentColor: "#F59E0B",
  supportPhone: "+260 211 234 500",
  supportEmail: "support@swiftlogistics.zm",
  domain: "swiftlogistics.parcelos.africa",
  trackingDomain: "track.swiftlogistics.zm",
  heroImageUrl: "/images/hero-courier-ops.jpg",
  priceChartUrl: "/images/price-chart-sample.svg",
};

/** Known demo companies — production would load from Supabase by slug/host. */
const TENANT_CATALOG: Record<string, TenantBranding> = {
  [DEMO_TENANT.slug]: DEMO_TENANT,
};

export function getTenantBySlug(slug: string): TenantBranding | null {
  const key = slug.trim().toLowerCase();
  const base = TENANT_CATALOG[key];
  if (!base) return null;
  return applyOverrides(base);
}

function applyOverrides(base: TenantBranding): TenantBranding {
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const overrides = JSON.parse(raw) as Partial<TenantBranding> & { slug?: string };
    // Overrides apply to the active demo company only (single-tenant local edits).
    if (overrides.slug && overrides.slug !== base.slug) return base;
    return { ...base, ...overrides, id: base.id, slug: base.slug };
  } catch {
    return base;
  }
}

export function getActiveTenantSlug(): string {
  if (typeof window === "undefined") return DEMO_TENANT.slug;
  try {
    return localStorage.getItem(ACTIVE_SLUG_KEY) || DEMO_TENANT.slug;
  } catch {
    return DEMO_TENANT.slug;
  }
}

export function setActiveTenantSlug(slug: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_SLUG_KEY, slug.trim().toLowerCase());
}

export function resolveTenantFromHost(_host?: string): TenantBranding {
  const slug = getActiveTenantSlug();
  return getTenantBySlug(slug) ?? DEMO_TENANT;
}

export function saveTenantOverrides(overrides: Partial<TenantBranding>) {
  if (typeof window === "undefined") return;
  const current = resolveTenantFromHost();
  const next = { ...current, ...overrides };
  const { id: _id, slug: _slug, ...persistable } = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...persistable, slug: current.slug }));
  return next;
}

/** URL-safe company name for `/c/{slug}` — customers must see the courier name in the link. */
export function slugifyCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Prefer real company slug; if missing/demo, build from courier company name
 * so the public link always contains the brand (e.g. `/c/mthunzi-tech-labs`).
 */
export function resolveCustomerPortalSlug(input: {
  slug?: string | null;
  name?: string | null;
}): string | null {
  const slug = input.slug?.trim().toLowerCase() || "";
  if (slug && slug !== DEMO_TENANT.slug) return slug;
  const fromName = input.name ? slugifyCompanyName(input.name) : "";
  if (fromName && fromName !== DEMO_TENANT.slug) return fromName;
  return slug || null;
}

/** Path customers open from share link / QR (works on any host). */
export function getCustomerPortalPath(slug: string): string {
  return `/c/${slug.trim().toLowerCase()}`;
}

/**
 * Public website origin for customer links.
 * Prefer VITE_APP_URL when the staff app is on localhost/LAN so WhatsApp/QR
 * always point at the lasting online site (Netlify / custom domain).
 */
export function getPublicAppOrigin(fallbackOrigin?: string): string {
  const fromEnv = (import.meta.env.VITE_APP_URL as string | undefined)?.trim().replace(/\/$/, "");
  const isPrivateHost = (host: string) =>
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (fromEnv?.startsWith("http") && isPrivateHost(host)) return fromEnv;
    if (!isPrivateHost(host)) return window.location.origin;
  }

  if (fallbackOrigin?.startsWith("http")) return fallbackOrigin.replace(/\/$/, "");
  if (fromEnv?.startsWith("http")) return fromEnv;
  return "http://localhost:3000";
}

/**
 * Absolute customer website URL — permanent `/c/{slug}` for unlimited visitors.
 * Same link works for WhatsApp, QR, posters, and browser bookmarks.
 */
export function getCustomerPortalUrl(tenant: TenantBranding, origin?: string): string {
  const path = getCustomerPortalPath(tenant.slug);
  return `${getPublicAppOrigin(origin)}${path}`;
}

/** Pretty domain companies show on posters (subdomain branding). */
export function getPublicPortalLabel(tenant: TenantBranding): string {
  if (tenant.domain && !tenant.domain.includes("swiftlogistics")) return tenant.domain;
  if (tenant.slug && tenant.slug !== "swift-logistics") return `${tenant.slug}.parcelos.africa`;
  return tenant.domain || `${tenant.slug}.parcelos.africa`;
}

export function getWhatsAppShareText(tenant: TenantBranding, portalUrl: string): string {
  return [
    `Send and track parcels with ${tenant.name}.`,
    tenant.tagline,
    "",
    `Our customer website (anyone can use this link):`,
    portalUrl,
  ].join("\n");
}

export function getWhatsAppShareUrl(tenant: TenantBranding, portalUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(getWhatsAppShareText(tenant, portalUrl))}`;
}
