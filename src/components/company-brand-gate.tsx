import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { isBrandSetupComplete } from "@/lib/api/company-brand";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const ALLOWED_WITHOUT_BRAND = ["/app/onboarding", "/app/settings", "/login"];

/**
 * Company admins must finish branding (logo + name) before using the workspace.
 * After setup they can share link / QR from the dashboard.
 */
export function CompanyBrandGate({ children }: { children: React.ReactNode }) {
  const { role, companyId, isDemoMode, isPlatformOwner } = useAuth();
  const { tenant, activateTenant, refreshTenant } = useTenant();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (isPlatformOwner || role !== "Company Admin" || isDemoMode || !isSupabaseConfigured()) {
        if (!cancelled) setReady(true);
        return;
      }

      // Prefer company UUID from auth profile when resolving brand
      if (companyId && tenant.id !== companyId) {
        // refresh by slug already active; also try resolve if slug known
        await refreshTenant();
      }

      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, isDemoMode, isPlatformOwner, refreshTenant, role, tenant.id]);

  useEffect(() => {
    if (!ready) return;
    if (isPlatformOwner || role !== "Company Admin" || isDemoMode || !isSupabaseConfigured()) return;
    if (ALLOWED_WITHOUT_BRAND.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

    if (!isBrandSetupComplete(tenant)) {
      void navigate({ to: "/app/onboarding", replace: true });
    }
  }, [isDemoMode, isPlatformOwner, navigate, pathname, ready, role, tenant]);

  // Keep activateTenant referenced so tree-shaking doesn't drop — used when wiring slug later
  void activateTenant;

  if (!ready) {
    return (
      <div className="grid min-h-svh place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Loading company…</p>
      </div>
    );
  }

  return <>{children}</>;
}
