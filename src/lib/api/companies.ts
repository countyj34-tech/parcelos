import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapDbCompanyToPlatform, type DbCompanyRow } from "@/lib/api/mappers";
import { applyLifecycleOverrides } from "@/lib/company-lifecycle";
import { getPlatformCompanies } from "@/lib/platform-data";
import { fetchConsoleOverview } from "@/lib/api/platform-console";

function asRpcArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export type CreateCompanyInput = {
  name: string;
  code: string;
  slug: string;
  country_code: string;
  currency_code: string;
  phone?: string;
  email?: string;
  website?: string;
  subdomain: string;
  default_language: string;
  timezone: string;
  plan_code: string;
  trial_days: number;
  admin_full_name: string;
  admin_email: string;
  admin_phone?: string;
  primary_color?: string;
  secondary_color?: string;
};

export type CreateCompanyResult = {
  companyId: string;
  loginUrl: string;
  subdomain: string;
};

export async function fetchPlatformCompanies() {
  if (!isSupabaseConfigured()) return getPlatformCompanies();

  const supabase = getSupabase();
  if (!supabase) return getPlatformCompanies();

  const { data, error } = await supabase.rpc("platform_console_list_companies");
  if (error) {
    console.warn("[fetchPlatformCompanies] console RPC", error.message);
    return [];
  }
  const rows = asRpcArray<DbCompanyRow>(data);
  if (!rows.length) return [];
  return applyLifecycleOverrides(
    rows.filter((row) => row && typeof row === "object").map(mapDbCompanyToPlatform),
  );
}

export async function createPlatformCompany(input: CreateCompanyInput): Promise<CreateCompanyResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + input.trial_days);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      name: input.name,
      code: input.code.toUpperCase(),
      slug: input.slug,
      registration_number: null,
      country_code: input.country_code,
      currency_code: input.currency_code,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      subdomain: input.subdomain,
      default_language: input.default_language,
      timezone: input.timezone,
      primary_color: input.primary_color ?? "#0F766E",
      secondary_color: input.secondary_color ?? "#F59E0B",
      status: "trial",
      trial_ends_at: trialEnds.toISOString(),
      created_by: user.id,
    })
    .select("id, subdomain")
    .single();

  if (companyError) throw new Error(companyError.message);

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", input.plan_code)
    .single();

  if (plan) {
    await supabase.from("subscriptions").insert({
      company_id: company.id,
      plan_id: plan.id,
      status: "trialing",
      trial_ends_at: trialEnds.toISOString(),
      current_period_end: trialEnds.toISOString(),
      created_by: user.id,
    });
  }

  await supabase.from("company_settings").insert({ company_id: company.id, created_by: user.id });

  await supabase.from("domains").insert({
    company_id: company.id,
    hostname: input.subdomain,
    domain_type: "subdomain",
    is_primary: true,
    ssl_status: "active",
    verified: true,
    created_by: user.id,
  });

  await supabase.from("branches").insert({
    company_id: company.id,
    code: "HQ",
    name: `${input.name} — Head Office`,
    city: input.country_code,
    country_code: input.country_code,
    is_head_office: true,
    created_by: user.id,
  });

  await supabase.from("audit_logs").insert({
    company_id: company.id,
    actor_id: user.id,
    action: "create",
    entity_type: "company",
    entity_id: company.id,
    description: `Company ${input.name} provisioned via platform console`,
  });

  return {
    companyId: company.id,
    subdomain: company.subdomain,
    loginUrl: `https://${company.subdomain}/login`,
  };
}

export async function fetchPlatformOverview() {
  return fetchConsoleOverview();
}
