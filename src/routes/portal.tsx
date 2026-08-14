import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { CompanyAccessGate } from "@/components/company-access-gate";
import { useAuth } from "@/hooks/use-auth";
import { useTenantPwaManifest } from "@/hooks/use-tenant-pwa-manifest";
import { isCustomerPortalMode, isReceptionRegisterMode } from "@/lib/portal-mode";
import { getHomeRouteForRole } from "@/lib/roles";
import { registerServiceWorker } from "@/lib/pwa";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isDemoMode, isSaasSuperAdmin, isCustomer, role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  useTenantPwaManifest();

  const staffWalkIn =
    pathname.startsWith("/portal/register") &&
    (searchStr.includes("from=reception") || isReceptionRegisterMode());
  const staffOk = (isAuthenticated || isDemoMode) && !isSaasSuperAdmin && !isCustomer;
  const customerOk = isCustomerPortalMode() || isCustomer;
  // Staff can preview/install customer portal on the same device without losing company login
  const allowed =
    customerOk ||
    staffWalkIn ||
    (staffOk && pathname.startsWith("/portal/register"));

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (allowed) return;
    // Staff who wander into portal stay in their workspace — never dump to marketing home
    if (staffOk) {
      void navigate({ to: getHomeRouteForRole(role), replace: true });
      return;
    }
    void navigate({ to: "/", replace: true });
  }, [allowed, navigate, role, staffOk]);

  if (!allowed) {
    return (
      <div className="grid min-h-svh place-items-center bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">Returning to your workspace…</p>
      </div>
    );
  }

  return (
    <CompanyAccessGate>
      <PortalShell>
        <Outlet />
      </PortalShell>
    </CompanyAccessGate>
  );
}
