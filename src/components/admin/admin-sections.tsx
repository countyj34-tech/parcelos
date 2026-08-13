import type { AdminSection } from "@/components/admin/admin-shell";
import { OverviewSection } from "@/components/admin/platform/overview-section";
import { CompaniesSection } from "@/components/admin/platform/companies-section";
import { CreateCompanyWizard } from "@/components/admin/platform/create-company-wizard";
import { CompanyDetailSection } from "@/components/admin/platform/company-detail-section";
import {
  AccountSection,
  AnalyticsSection,
  AuditLogsSection,
  BillingSection,
  CustomersSection,
  DomainsSection,
  FeatureFlagsSection,
  IntegrationsSection,
  NotificationsSection,
  PlansSection,
  PlatformSettingsSection,
  PlatformUsersSection,
  SmsCenterSection,
  StorageSection,
  SubscriptionsSection,
  SupportSection,
  SystemLogsSection,
} from "@/components/admin/platform/misc-sections";

export function AdminSectionContent({
  section,
  company,
}: {
  section: AdminSection;
  company?: string;
}) {
  switch (section) {
    case "overview":
      return <OverviewSection />;
    case "companies":
      return <CompaniesSection />;
    case "create-company":
      return <CreateCompanyWizard />;
    case "company-detail":
      return <CompanyDetailSection slug={company ?? ""} />;
    case "subscriptions":
      return <SubscriptionsSection />;
    case "plans":
      return <PlansSection />;
    case "customers":
      return <CustomersSection />;
    case "platform-users":
      return <PlatformUsersSection />;
    case "domains":
      return <DomainsSection />;
    case "sms":
      return <SmsCenterSection />;
    case "notifications":
      return <NotificationsSection />;
    case "support":
      return <SupportSection />;
    case "analytics":
      return <AnalyticsSection />;
    case "billing":
      return <BillingSection />;
    case "feature-flags":
      return <FeatureFlagsSection />;
    case "system-logs":
      return <SystemLogsSection />;
    case "storage":
      return <StorageSection />;
    case "integrations":
      return <IntegrationsSection />;
    case "settings":
      return <PlatformSettingsSection />;
    case "audit-logs":
      return <AuditLogsSection />;
    case "account":
      return <AccountSection />;
    default:
      return <OverviewSection />;
  }
}
