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

async function resolveUploadCompanyId(preferred?: string | null): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: myId } = await supabase.rpc("get_my_company_id");
  if (isCompanyUuid(myId as string)) return myId as string;
  if (isCompanyUuid(preferred)) return preferred;
  return null;
}

async function uploadLogoViaEdge(file: File): Promise<{ url: string } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase not available" };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!token || !base || !anon) return { error: "Sign in required" };

  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`${base}/functions/v1/upload-company-logo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    return { error: json.error ?? "Logo upload failed" };
  }
  return { url: json.url };
}

/** Upload logo — tries direct storage, then secure edge upload if RLS blocks. */
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

  const resolvedId = await resolveUploadCompanyId(companyId);
  if (!resolvedId) {
    return {
      error: "Company not linked yet. Refresh the page or sign in again, then upload the logo.",
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ["png", "jpg", "jpeg", "webp", "svg"].includes(ext) ? ext : "png";
  const path = `${resolvedId}/logo-${Date.now()}.${safeExt}`;

  const { error: upErr } = await supabase.storage.from("company-logos").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });

  if (!upErr) {
    const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
    return { url: data.publicUrl };
  }

  // Storage RLS still blocking — use service-role edge function
  if (/row-level security|rls|policy/i.test(upErr.message)) {
    const viaEdge = await uploadLogoViaEdge(file);
    if ("url" in viaEdge) return viaEdge;
    return {
      error:
        viaEdge.error ||
        "Logo upload blocked. Run 20260312000022_fix_logo_storage_rls.sql in Supabase SQL Editor (and deploy upload-company-logo).",
    };
  }

  return { error: upErr.message || "Upload failed" };
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
