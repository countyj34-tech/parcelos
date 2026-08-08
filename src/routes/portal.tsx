import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { CompanyAccessGate } from "@/components/company-access-gate";
import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
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
