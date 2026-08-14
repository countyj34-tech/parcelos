import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isSuperAdminPatternUnlocked } from "@/lib/super-admin-unlock";
import type { TenantBranding } from "@/lib/tenant";

export type PublicCompanyRow = {
  id: string;
  name: string;
  slug: string;
  code: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  hero_image_url: string | null;
  price_chart_url: string | null;
  support_phone: string | null;
  support_email: string | null;
  subdomain: string;
  tracking_domain: string | null;
  currency_code: string;
  country_code: string;
  status: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function mapPublicCompanyToTenant(row: PublicCompanyRow): TenantBranding {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline ?? "",
    logoInitials: initials(row.name),
    logoUrl: row.logo_url,
    primaryColor: row.primary_color ?? "#0F766E",
    primaryForeground: "#FFFFFF",
    accentColor: row.secondary_color ?? "#F59E0B",
    supportPhone: row.support_phone ?? "",
    supportEmail: row.support_email ?? "",
    domain: row.subdomain,
    trackingDomain: row.tracking_domain ?? row.subdomain,
    heroImageUrl: row.hero_image_url ?? "/images/hero-courier-ops.jpg",
    priceChartUrl: row.price_chart_url,
  };
}

/** Resolve company by slug / subdomain / hostname via Supabase RPC. */
export async function resolveCompanyPublic(key: string): Promise<TenantBranding | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("resolve_company_public", {
    p_key: key.trim().toLowerCase(),
  });

  if (error) {
    console.warn("[resolveCompanyPublic]", error.message);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as PublicCompanyRow | undefined;
  if (!row?.id) return null;
  return mapPublicCompanyToTenant(row);
}

/** Load branding for the signed-in company by UUID (dashboard share/QR). */
export async function resolveCompanyById(companyId: string): Promise<TenantBranding | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase || !companyId) return null;

  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, slug, code, tagline, logo_url, primary_color, secondary_color, hero_image_url, price_chart_url, support_phone, support_email, subdomain, tracking_domain, currency_code, country_code, status",
    )
    .eq("id", companyId)
    .eq("soft_delete", false)
    .maybeSingle();

  if (error) {
    console.warn("[resolveCompanyById]", error.message);
    return null;
  }
  if (!data) return null;
  return mapPublicCompanyToTenant(data as PublicCompanyRow);
}

export async function isCompanyLockedRemote(companyId: string): Promise<boolean | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("is_company_locked", {
    p_company_id: companyId,
  });

  if (error) {
    console.warn("[isCompanyLockedRemote]", error.message);
    return null;
  }

  return Boolean(data);
}

const UI_TO_DB_STATUS: Record<string, string> = {
  Active: "active",
  Trial: "trial",
  Expired: "expired",
  Suspended: "suspended",
  Paused: "paused",
  Disconnected: "disconnected",
  "Past due": "past_due",
};

/** Platform kill switch — requires signed-in platform owner. */
export async function setCompanyLifecycleRemote(
  companyId: string,
  uiStatus: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not available" };

  const p_status = UI_TO_DB_STATUS[uiStatus] ?? uiStatus.toLowerCase().replace(/\s+/g, "_");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const rpcName =
    !session && isSuperAdminPatternUnlocked()
      ? "platform_console_set_lifecycle"
      : "set_company_lifecycle";

  const { error } = await supabase.rpc(rpcName, {
    p_company_id: companyId,
    p_status,
    p_reason: reason ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function findCompanyIdBySlug(slug: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: rpcId, error: rpcError } = await supabase.rpc("platform_console_company_id", {
    p_slug: slug,
  });
  if (!rpcError && rpcId) return rpcId as string;

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", slug)
    .eq("soft_delete", false)
    .maybeSingle();

  if (error || !data) return null;
  return data.id as string;
}
