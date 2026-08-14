import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapDbCompanyToPlatform, type DbCompanyRow } from "@/lib/api/mappers";
import { applyLifecycleOverrides } from "@/lib/company-lifecycle";
import { getPlatformCompanies } from "@/lib/platform-data";
import { isSuperAdminPatternUnlocked } from "@/lib/super-admin-unlock";

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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && isSuperAdminPatternUnlocked()) {
    const { data, error } = await supabase.rpc("platform_console_list_companies");
    if (error) {
      console.warn("[fetchPlatformCompanies] console RPC", error.message);
      return [];
    }
    const rows = (data ?? []) as DbCompanyRow[];
    if (!rows.length) return [];
    return applyLifecycleOverrides(rows.map(mapDbCompanyToPlatform));
  }

  if (!session) return [];

  const { data, error } = await supabase
    .from("companies")
    .select(`
      id,
      name,
      code,
      slug,
      country_code,
      status,
      subdomain,
      trial_ends_at,
      created_at,
      subscriptions(
        status,
        subscription_plans(name)
      )
    `)
    .eq("soft_delete", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[fetchPlatformCompanies]", error.message);
    return [];
  }

  if (!data?.length) return [];

  return applyLifecycleOverrides((data as DbCompanyRow[]).map(mapDbCompanyToPlatform));
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
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && isSuperAdminPatternUnlocked()) {
    const { data, error } = await supabase.rpc("platform_console_overview");
    if (error || !data) return null;
    return data as {
      total: number;
      active: number;
      trial: number;
      paused: number;
      suspended: number;
      expired: number;
    };
  }

  const { data: companies } = await supabase
    .from("companies")
    .select("status")
    .eq("soft_delete", false);

  if (!companies) return null;

  const counts = companies.reduce(
    (acc, c) => {
      acc[c.status as string] = (acc[c.status as string] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    activeCompanies: counts.active ?? 0,
    trialCompanies: counts.trial ?? 0,
    expiredCompanies: counts.expired ?? 0,
    suspendedCompanies: (counts.suspended ?? 0) + (counts.paused ?? 0),
    totalCompanies: companies.length,
  };
}
