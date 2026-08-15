import { lazy, Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLoadingScreen } from "@/components/splash-screen";
import { ClientOnly } from "@/components/client-only";
import { ProductMeta } from "@/components/logo";
import type { AdminSection } from "@/components/admin/admin-shell";

const AdminConsoleClient = lazy(() => import("@/components/admin/admin-console-client"));

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
  validateSearch: (search: Record<string, unknown>) => {
    const section = SECTIONS.includes(search["section"] as AdminSection)
      ? (search["section"] as AdminSection)
      : "overview";
    const company = typeof search["company"] === "string" ? search["company"] : undefined;
    return company ? { section, company } : { section };
  },
  head: () => ({
    meta: [
      { title: ProductMeta("Platform console") },
      { name: "description", content: "MTHUNZI-TECH-LABS ParcelOS Platform Console." },
    ],
  }),
  errorComponent: AdminRouteError,
  component: AdminConsole,
});

function AdminRouteError({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[admin route]", error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Platform console unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "The admin route hit an unexpected error."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminConsole() {
  const { section, company } = Route.useSearch();

  return (
    <ClientOnly fallback={<AuthLoadingScreen />}>
      {() => (
        <Suspense fallback={<AuthLoadingScreen />}>
          <AdminConsoleClient section={section} company={company} />
        </Suspense>
      )}
    </ClientOnly>
  );
}
