import { AdminSectionContent } from "@/components/admin/admin-sections";
import { AdminShell, type AdminSection } from "@/components/admin/admin-shell";
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SaasAdminGate } from "@/components/auth/saas-admin-gate";

export default function AdminConsoleClient({
  section,
  company,
}: {
  section: AdminSection;
  company?: string;
}) {
  return (
    <AdminErrorBoundary>
      <SaasAdminGate>
        <AuthGuard requirePlatform>
          <AdminShell section={section}>
            <AdminSectionContent section={section} company={company} />
          </AdminShell>
        </AuthGuard>
      </SaasAdminGate>
    </AdminErrorBoundary>
  );
}
