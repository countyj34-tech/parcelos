import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { TenantBranding } from "@/lib/tenant";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCompanyUuid(id: string | null | undefined): id is string {
  return Boolean(id && UUID_RE.test(id));
}

export type BrandUpdateInput = {
  companyId: string;
  name: string;
  tagline?: string;
  primaryColor: string;
  accentColor: string;
  supportPhone?: string;
  supportEmail?: string;
  logoUrl?: string | null;
  priceChartUrl?: string | null;
};

/** Persist branding for the signed-in company (RPC — avoids RLS update gaps). */
export async function updateCompanyBrand(
  input: BrandUpdateInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not available" };

  if (!isCompanyUuid(input.companyId)) {
    return { ok: false, error: "Company account not ready — sign out and sign in again" };
  }

  const { error } = await supabase.rpc("update_my_company_brand", {
    p_name: input.name.trim(),
    p_tagline: input.tagline?.trim() || null,
    p_primary_color: input.primaryColor,
    p_secondary_color: input.accentColor,
    p_support_phone: input.supportPhone?.trim() || null,
    p_support_email: input.supportEmail?.trim() || null,
    p_logo_url: input.logoUrl ?? null,
    p_price_chart_url: input.priceChartUrl ?? null,
  });

  if (error) {
    // Fallback if migration 20 not applied yet
    if (/function .*update_my_company_brand/i.test(error.message) || error.code === "PGRST202") {
      const { error: upErr } = await supabase
        .from("companies")
        .update({
          name: input.name.trim(),
          tagline: input.tagline?.trim() || null,
          primary_color: input.primaryColor,
          secondary_color: input.accentColor,
          support_phone: input.supportPhone?.trim() || null,
          support_email: input.supportEmail?.trim() || null,
          ...(input.logoUrl !== undefined ? { logo_url: input.logoUrl } : {}),
          ...(input.priceChartUrl !== undefined ? { price_chart_url: input.priceChartUrl } : {}),
        })
        .eq("id", input.companyId);
      if (upErr) return { ok: false, error: upErr.message };
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Upload logo to public `company-logos` bucket; path must start with real company UUID. */
export async function uploadCompanyLogo(
  companyId: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (!isSupabaseConfigured()) {
    const dataUrl = await fileToDataUrl(file);
    return { url: dataUrl };
  }

  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase not available" };

  if (!isCompanyUuid(companyId)) {
    return {
      error: "Company not linked yet. Refresh the page or sign in again, then upload the logo.",
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ["png", "jpg", "jpeg", "webp", "svg"].includes(ext) ? ext : "png";
  const path = `${companyId}/logo-${Date.now()}.${safeExt}`;

  const { error: upErr } = await supabase.storage.from("company-logos").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });

  if (upErr) {
    const msg = upErr.message || "Upload failed";
    if (/row-level security|rls/i.test(msg)) {
      return {
        error:
          "Logo upload blocked by security policy. Run migration 20260312000020_company_brand_rls.sql in Supabase SQL Editor, then try again.",
      };
    }
    return { error: msg };
  }

  const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
  return { url: data.publicUrl };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Branding is incomplete until a real logo is saved (company admin first-run). */
export function isBrandSetupComplete(tenant: TenantBranding): boolean {
  const looksUuid = isCompanyUuid(tenant.id);
  if (!looksUuid && !isSupabaseConfigured()) {
    return Boolean(tenant.logoUrl);
  }
  return Boolean(tenant.logoUrl && tenant.name.trim());
}
