import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/backend/database/types";
import { AppError } from "@/backend/errors/app-error";

export type AuthContext = {
  user: User;
  userId: string;
  companyId: string | null;
  roleCode: string | null;
  isPlatformOwner: boolean;
};

/**
 * Resolves authenticated user context from Supabase JWT.
 * Used by API routes and server functions before service calls.
 */
export async function resolveAuthContext(db: SupabaseClient<Database>): Promise<AuthContext> {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw AppError.unauthorized();

  const { data: platformUser } = await db
    .from("platform_users")
    .select("id, role_id, roles(code)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (platformUser) {
    const role = platformUser.roles as { code: string } | null;
    return {
      user,
      userId: user.id,
      companyId: null,
      roleCode: role?.code ?? "platform_owner",
      isPlatformOwner: true,
    };
  }

  const { data: profile } = await db
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .eq("is_active", true)
    .single();

  if (!profile?.company_id) {
    throw AppError.forbidden("No company association found");
  }

  const { data: company } = await db
    .from("companies")
    .select("status")
    .eq("id", profile.company_id)
    .single();

  if (company?.status === "suspended" || company?.status === "disconnected") {
    throw AppError.companySuspended();
  }

  const { data: staff } = await db
    .from("staff")
    .select("role_id, roles(code)")
    .eq("user_id", user.id)
    .eq("company_id", profile.company_id)
    .eq("is_active", true)
    .single();

  const role = staff?.roles as { code: string } | null;

  return {
    user,
    userId: user.id,
    companyId: profile.company_id,
    roleCode: role?.code ?? null,
    isPlatformOwner: false,
  };
}

/** Ensures the caller has one of the required roles. */
export function requireRole(ctx: AuthContext, roles: string[]): void {
  if (ctx.isPlatformOwner) return;
  if (!ctx.roleCode || !roles.includes(ctx.roleCode)) {
    throw AppError.forbidden(`Required role: ${roles.join(" or ")}`);
  }
}

/** Ensures tenant context exists (non-platform routes). */
export function requireTenant(ctx: AuthContext): asserts ctx is AuthContext & { companyId: string } {
  if (!ctx.companyId) throw AppError.forbidden("Company context required");
}
