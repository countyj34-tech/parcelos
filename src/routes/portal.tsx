import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { CompanyAccessGate } from "@/components/company-access-gate";
import { useAuth } from "@/hooks/use-auth";
import { useTenantPwaManifest } from "@/hooks/use-tenant-pwa-manifest";
import { isCustomerPortalMode } from "@/lib/portal-mode";
import { registerServiceWorker } from "@/lib/pwa";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isDemoMode, isPlatformOwner, isCustomer } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  useTenantPwaManifest();

  const staffWalkIn =
    pathname.startsWith("/portal/register") && searchStr.includes("from=reception");
  const staffOk = (isAuthenticated || isDemoMode) && !isPlatformOwner && !isCustomer;
  const customerOk = isCustomerPortalMode();
  const allowed = customerOk || staffWalkIn || (staffOk && pathname.startsWith("/portal/register"));

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!allowed) {
      void navigate({ to: "/", replace: true });
    }
  }, [allowed, navigate]);

  if (!allowed) {
    return (
      <div className="grid min-h-svh place-items-center bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">Opening company workspace…</p>
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
