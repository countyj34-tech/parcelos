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

/** Path customers open from share link / QR (works on any host in demo). */
export function getCustomerPortalPath(slug: string): string {
  return `/c/${slug.trim().toLowerCase()}`;
}

/**
 * Absolute URL for WhatsApp / social / QR.
 * On localhost uses `/c/{slug}` so the link works immediately.
 * In production the marketing domain can still be shown separately.
 */
export function getCustomerPortalUrl(tenant: TenantBranding, origin?: string): string {
  const path = getCustomerPortalPath(tenant.slug);
  if (typeof window !== "undefined") {
    return `${origin ?? window.location.origin}${path}`;
  }
  return `https://${tenant.domain}${path}`;
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
    `Open our portal: ${portalUrl}`,
  ].join("\n");
}

export function getWhatsAppShareUrl(tenant: TenantBranding, portalUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(getWhatsAppShareText(tenant, portalUrl))}`;
}
