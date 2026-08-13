import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CompanyAccessGate } from "@/components/company-access-gate";
import { CompanyBrandGate } from "@/components/company-brand-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { clearCustomerPortalMode } from "@/lib/portal-mode";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { profile } = useAuth();
  const { activateTenant } = useTenant();

  useEffect(() => {
    // Company workspace — leave customer PWA mode so both systems can coexist on one device
    clearCustomerPortalMode();
  }, []);

  useEffect(() => {
    if (profile?.companySlug) {
      void activateTenant(profile.companySlug);
    }
  }, [activateTenant, profile?.companySlug]);

  return (
    <AuthGuard requireStaff>
      <CompanyAccessGate>
        <CompanyBrandGate>
          <DashboardShell>
            <Outlet />
          </DashboardShell>
        </CompanyBrandGate>
      </CompanyAccessGate>
    </AuthGuard>
  );
}
