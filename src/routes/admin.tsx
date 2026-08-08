import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionContent } from "@/components/admin/admin-sections";
import { AdminShell, type AdminSection } from "@/components/admin/admin-shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ProductMeta } from "@/components/logo";

const SECTIONS: AdminSection[] = [
  "overview",
  "companies",
  "create-company",
  "company-detail",
  "subscriptions",
  "plans",
  "customers",
  "platform-users",
  "domains",
  "sms",
  "notifications",
  "support",
  "analytics",
  "billing",
  "feature-flags",
  "system-logs",
  "storage",
  "integrations",
  "settings",
  "audit-logs",
  "account",
];

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: SECTIONS.includes(search.section as AdminSection)
      ? (search.section as AdminSection)
      : "overview",
    company: typeof search.company === "string" ? search.company : undefined,
  }),
  head: () => ({
    meta: [
      { title: ProductMeta("Platform console") },
      { name: "description", content: "MTHUNZI-TECH-LABS ParcelOS Platform Console." },
    ],
  }),
  component: AdminConsole,
});

function AdminConsole() {
  const { section, company } = Route.useSearch();

  return (
    <AuthGuard requirePlatform>
      <AdminShell section={section}>
        <AdminSectionContent section={section} company={company} />
      </AdminShell>
    </AuthGuard>
  );
}
