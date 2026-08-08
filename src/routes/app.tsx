import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CompanyAccessGate } from "@/components/company-access-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <AuthGuard requireStaff>
      <CompanyAccessGate>
        <DashboardShell>
          <Outlet />
        </DashboardShell>
      </CompanyAccessGate>
    </AuthGuard>
  );
}
