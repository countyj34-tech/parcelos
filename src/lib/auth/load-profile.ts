import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { toUiRole } from "@/lib/auth/role-map";
import type { UserRole } from "@/lib/roles";
import { ROLE_USERS } from "@/lib/roles";
import { DEMO_COMPANY } from "@/lib/brand";

export type AuthProfile = {
  userId: string;
  email: string;
  fullName: string;
  initials: string;
  role: UserRole;
  roleCode: string | null;
  companyId: string | null;
  companyName: string;
  companySlug: string | null;
  branch: string;
  isPlatformOwner: boolean;
  isCustomer: boolean;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Loads tenant context from PostgreSQL after Supabase Auth sign-in. */
export async function loadAuthProfile(session: Session): Promise<AuthProfile> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const userId = session.user.id;
  const email = session.user.email ?? "";

  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("full_name, roles(code)")
    .eq("auth_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (platformUser) {
    const roleRow = platformUser.roles as { code: string } | null;
    const roleCode = roleRow?.code ?? "platform_owner";
    const fullName = platformUser.full_name ?? "Platform Admin";
    return {
      userId,
      email,
      fullName,
      initials: initials(fullName),
      role: toUiRole(roleCode),
      roleCode,
      companyId: null,
      companyName: "ParcelOS Platform",
      companySlug: null,
      branch: "Platform",
      isPlatformOwner: true,
      isCustomer: false,
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, company_id, user_type, companies(name, slug)")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (profile?.user_type === "customer") {
    const fullName = profile.full_name ?? email;
    const companyRow = profile.companies as { name: string; slug: string } | null;
    return {
      userId,
      email,
      fullName,
      initials: initials(fullName),
      role: "Customer",
      roleCode: "customer",
      companyId: profile.company_id,
      companyName: companyRow?.name ?? DEMO_COMPANY,
      companySlug: companyRow?.slug ?? null,
      branch: "Customer",
      isPlatformOwner: false,
      isCustomer: true,
    };
  }

  const { data: staff } = await supabase
    .from("staff")
    .select(`
      id,
      company_id,
      roles(code),
      companies(name, slug),
      staff_branch_assignments(
        is_primary,
        branches(name)
      )
    `)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (staff) {
    const roleRow = staff.roles as { code: string } | null;
    const roleCode = roleRow?.code ?? "company_admin";
    const companyRow = staff.companies as { name: string; slug: string } | null;
    const assignments = staff.staff_branch_assignments as Array<{
      is_primary: boolean;
      branches: { name: string } | null;
    }> | null;
    const primaryBranch =
      assignments?.find((a) => a.is_primary)?.branches?.name ??
      assignments?.[0]?.branches?.name ??
      "All Branches";

    const fullName = profile?.full_name ?? email;
    return {
      userId,
      email,
      fullName,
      initials: initials(fullName),
      role: toUiRole(roleCode),
      roleCode,
      companyId: staff.company_id,
      companyName: companyRow?.name ?? DEMO_COMPANY,
      companySlug: companyRow?.slug ?? null,
      branch: roleCode === "company_admin" ? "All Branches" : primaryBranch,
      isPlatformOwner: false,
      isCustomer: false,
    };
  }

  const fallback = ROLE_USERS["Company Admin"];
  return {
    userId,
    email,
    fullName: profile?.full_name ?? fallback.name,
    initials: initials(profile?.full_name ?? fallback.name),
    role: "Company Admin",
    roleCode: "company_admin",
    companyId: profile?.company_id ?? null,
    companyName: DEMO_COMPANY,
    companySlug: null,
    branch: fallback.branch,
    isPlatformOwner: false,
    isCustomer: false,
  };
}

export function demoProfile(role: UserRole): AuthProfile {
  const demo = ROLE_USERS[role];
  return {
    userId: "demo",
    email: demo.email,
    fullName: demo.name,
    initials: demo.initials,
    role,
    roleCode: null,
    companyId: null,
    companyName: DEMO_COMPANY,
    companySlug: "swift-logistics",
    branch: demo.branch,
    isPlatformOwner: role === "Super Admin",
    isCustomer: false,
  };
}
