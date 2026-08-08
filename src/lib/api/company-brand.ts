import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { TenantBranding } from "@/lib/tenant";

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

/** Persist branding to `companies` (requires authenticated company staff / platform). */
export async function updateCompanyBrand(
  input: BrandUpdateInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not available" };

  const { error } = await supabase
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

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Upload logo to public `company-logos` bucket; returns public URL. */
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

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${companyId}/logo-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from("company-logos").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });

  if (upErr) return { error: upErr.message };

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
  const looksUuid = /^[0-9a-f-]{36}$/i.test(tenant.id);
  if (!looksUuid && !isSupabaseConfigured()) {
    // Demo local: treat local overrides with logo as complete
    return Boolean(tenant.logoUrl);
  }
  return Boolean(tenant.logoUrl && tenant.name.trim());
}
