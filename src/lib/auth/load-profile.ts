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
  logoUrl?: string | null;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
};

type WorkspaceRow = {
  company_id: string;
  company_name: string;
  company_slug: string;
  subdomain: string | null;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  support_phone: string | null;
  support_email: string | null;
  role_code: string | null;
  full_name: string | null;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "User";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "User";
}

async function loadWorkspaceViaRpc(userId: string, email: string, fallbackName: string): Promise<AuthProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  // Repair users.company_id if staff exists but link is missing (migration 25)
  try {
    await supabase.rpc("repair_my_company_link");
  } catch {
    /* optional until migration applied */
  }

  const { data, error } = await supabase.rpc("get_my_workspace");
  if (error) {
    console.warn("[get_my_workspace]", error.message);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as WorkspaceRow | null | undefined;
  if (!row?.company_id) {
    // Fallback: just the company id RPC
    const { data: cid } = await supabase.rpc("get_my_company_id");
    if (!cid) return null;
    const { data: company } = await supabase
      .from("companies")
      .select("id, name, slug, logo_url")
      .eq("id", cid as string)
      .maybeSingle();
    if (!company) {
      return {
        userId,
        email,
        fullName: fallbackName,
        initials: initials(fallbackName),
        role: "Company Admin",
        roleCode: "company_admin",
        companyId: cid as string,
        companyName: "Your company",
        companySlug: null,
        branch: "All Branches",
        isPlatformOwner: false,
        isCustomer: false,
      };
    }
    return {
      userId,
      email,
      fullName: fallbackName,
      initials: initials(fallbackName),
      role: "Company Admin",
      roleCode: "company_admin",
      companyId: company.id as string,
      companyName: (company.name as string) || "Your company",
      companySlug: (company.slug as string) || null,
      branch: "All Branches",
      isPlatformOwner: false,
      isCustomer: false,
      logoUrl: (company.logo_url as string | null) ?? null,
    };
  }

  const fullName = (row.full_name && String(row.full_name).trim()) || fallbackName;
  const roleCode = row.role_code ?? "company_admin";
  return {
    userId,
    email,
    fullName,
    initials: initials(fullName),
    role: toUiRole(roleCode),
    roleCode,
    companyId: row.company_id,
    companyName: row.company_name || "Your company",
    companySlug: row.company_slug || null,
    branch: roleCode === "company_admin" ? "All Branches" : "Assigned branch",
    isPlatformOwner: false,
    isCustomer: false,
    logoUrl: row.logo_url,
  };
}

/** Loads tenant context from PostgreSQL after Supabase Auth sign-in. */
export async function loadAuthProfile(session: Session): Promise<AuthProfile> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const userId = session.user.id;
  const email = session.user.email ?? "";
  const meta = session.user.user_metadata ?? {};
  const metaName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const fallbackName = metaName || displayNameFromEmail(email);

  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("full_name, roles(code)")
    .eq("auth_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  // Fallback if RLS blocked the table read
  if (!platformUser) {
    try {
      const { data: isOwner } = await supabase.rpc("is_my_platform_owner");
      if (isOwner) {
        return {
          userId,
          email,
          fullName: fallbackName || "Platform Admin",
          initials: initials(fallbackName || "PA"),
          role: "Super Admin",
          roleCode: "platform_owner",
          companyId: null,
          companyName: "ParcelOS Platform",
          companySlug: null,
          branch: "Platform",
          isPlatformOwner: true,
          isCustomer: false,
        };
      }
    } catch {
      /* optional until migration 29 */
    }
  }

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
    .select("full_name, company_id, user_type, companies(name, slug, logo_url)")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (profile?.user_type === "customer") {
    const fullName = profile.full_name ?? email;
    const companyRow = profile.companies as { name: string; slug: string; logo_url?: string | null } | null;
    return {
      userId,
      email,
      fullName,
      initials: initials(fullName),
      role: "Customer",
      roleCode: "customer",
      companyId: profile.company_id,
      companyName: companyRow?.name ?? "Your company",
      companySlug: companyRow?.slug ?? null,
      branch: "Customer",
      isPlatformOwner: false,
      isCustomer: true,
      logoUrl: companyRow?.logo_url ?? null,
    };
  }

  // Prefer SECURITY DEFINER workspace RPC — survives staff RLS edge cases
  const viaRpc = await loadWorkspaceViaRpc(userId, email, fallbackName);
  if (viaRpc) return viaRpc;

  const { data: staff } = await supabase
    .from("staff")
    .select(`
      id,
      company_id,
      roles(code),
      companies(name, slug, logo_url),
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
    const companyRow = staff.companies as { name: string; slug: string; logo_url?: string | null } | null;
    const assignments = staff.staff_branch_assignments as Array<{
      is_primary: boolean;
      branches: { name: string } | null;
    }> | null;
    const primaryBranch =
      assignments?.find((a) => a.is_primary)?.branches?.name ??
      assignments?.[0]?.branches?.name ??
      "All Branches";

    const fullName = (profile?.full_name && String(profile.full_name).trim()) || fallbackName;
    return {
      userId,
      email,
      fullName,
      initials: initials(fullName),
      role: toUiRole(roleCode),
      roleCode,
      companyId: staff.company_id,
      companyName: companyRow?.name ?? "Your company",
      companySlug: companyRow?.slug ?? null,
      branch: roleCode === "company_admin" ? "All Branches" : primaryBranch,
      isPlatformOwner: false,
      isCustomer: false,
      logoUrl: companyRow?.logo_url ?? null,
    };
  }

  const companyRow = profile?.companies as { name: string; slug: string; logo_url?: string | null } | null;
  const fullName = (profile?.full_name && String(profile.full_name).trim()) || fallbackName;
  return {
    userId,
    email,
    fullName,
    initials: initials(fullName),
    role: "Company Admin",
    roleCode: "company_admin",
    companyId: profile?.company_id ?? null,
    companyName: companyRow?.name ?? "Your company",
    companySlug: companyRow?.slug ?? null,
    branch: "All Branches",
    isPlatformOwner: false,
    isCustomer: false,
    logoUrl: companyRow?.logo_url ?? null,
  };
}

const PROFILE_CACHE_PREFIX = "parcelos-profile-cache:";

export function cacheAuthProfile(profile: AuthProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PROFILE_CACHE_PREFIX}${profile.userId}`, JSON.stringify(profile));
  } catch {
    /* quota / private mode */
  }
}

export function readCachedAuthProfile(userId: string): AuthProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthProfile;
    if (!parsed?.userId || parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCachedAuthProfile(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`);
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PROFILE_CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/** Minimal profile from the stored session so the app can open when profile APIs are unreachable. */
export function sessionFallbackProfile(session: Session): AuthProfile {
  const email = session.user.email ?? "";
  const meta = session.user.user_metadata ?? {};
  const metaName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const fullName = metaName || displayNameFromEmail(email) || "User";
  return {
    userId: session.user.id,
    email,
    fullName,
    initials: initials(fullName),
    role: "Company Admin",
    roleCode: "company_admin",
    companyId: typeof meta.company_id === "string" ? meta.company_id : null,
    companyName: typeof meta.company_name === "string" ? meta.company_name : "Your company",
    companySlug: typeof meta.company_slug === "string" ? meta.company_slug : null,
    branch: "All Branches",
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
