import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { isBrandSetupComplete, isCompanyUuid } from "@/lib/api/company-brand";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SplashScreen } from "@/components/splash-screen";

const ALLOWED_WITHOUT_BRAND = ["/app/onboarding", "/app/settings", "/login"];

/**
 * Company admins must finish branding (logo + name) before using the workspace.
 * After setup they can share link / QR from the dashboard.
 */
export function CompanyBrandGate({ children }: { children: React.ReactNode }) {
  const { role, companyId, profile, isDemoMode, isSaasSuperAdmin, isLoading } = useAuth();
  const { tenant, refreshTenant } = useTenant();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (isSaasSuperAdmin || role !== "Company Admin" || isDemoMode || !isSupabaseConfigured()) {
        if (!cancelled) setReady(true);
        return;
      }
      if (isLoading) return;

      if (isCompanyUuid(companyId)) {
        await refreshTenant();
      }

      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, isDemoMode, isLoading, isSaasSuperAdmin, refreshTenant, role]);

  useEffect(() => {
    if (!ready || isLoading) return;
    if (isSaasSuperAdmin || role !== "Company Admin" || isDemoMode || !isSupabaseConfigured()) return;
    if (ALLOWED_WITHOUT_BRAND.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

    // Brand already saved in DB (profile) — don't bounce to empty onboarding
    const profileComplete = Boolean(profile?.logoUrl && profile.companyName && profile.companyName !== "Your company");
    if (profileComplete || isBrandSetupComplete(tenant)) return;

    // Only force onboarding when we know the company exists but brand is incomplete
    if (isCompanyUuid(companyId) || isCompanyUuid(tenant.id)) {
      void navigate({ to: "/app/onboarding", replace: true });
    }
  }, [
    companyId,
    isDemoMode,
    isLoading,
    isSaasSuperAdmin,
    navigate,
    pathname,
    profile?.companyName,
    profile?.logoUrl,
    ready,
    role,
    tenant,
  ]);

  if (!ready || (isLoading && !isDemoMode)) {
    return (
      <SplashScreen
        variant="company"
        subtitle={tenant.name && tenant.name !== "Your company" ? tenant.name : "Loading your company…"}
      />
    );
  }

  return <>{children}</>;
}
