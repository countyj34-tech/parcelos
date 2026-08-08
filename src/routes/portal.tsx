import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { CompanyAccessGate } from "@/components/company-access-gate";
import { useTenantPwaManifest } from "@/hooks/use-tenant-pwa-manifest";
import { registerServiceWorker } from "@/lib/pwa";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
  useTenantPwaManifest();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <CompanyAccessGate>
      <PortalShell>
        <Outlet />
      </PortalShell>
    </CompanyAccessGate>
  );
}
