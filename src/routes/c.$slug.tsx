import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTenant } from "@/hooks/use-tenant";
import { useTenantPwaManifest } from "@/hooks/use-tenant-pwa-manifest";

/**
 * Customer entry from share link / QR.
 * Activates that company's brand, then opens their portal.
 */
export const Route = createFileRoute("/c/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `Open portal — ${params.slug}` }],
  }),
  component: CustomerTenantEntry,
});

function CustomerTenantEntry() {
  const { slug } = Route.useParams();
  const { activateTenant, tenant } = useTenant();
  const navigate = useNavigate();
  useTenantPwaManifest();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await activateTenant(slug);
      if (!cancelled) {
        void navigate({ to: "/portal", replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, activateTenant, navigate]);

  return (
    <div className="grid min-h-svh place-items-center bg-background px-6 text-center">
      <div>
        <p className="text-sm font-medium text-foreground">
          Opening {tenant.slug === slug ? tenant.name : "your courier"} portal…
        </p>
        <p className="mt-1 text-xs text-muted-foreground">One moment</p>
      </div>
    </div>
  );
}
