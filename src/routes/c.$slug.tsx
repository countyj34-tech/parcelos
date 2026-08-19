import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CompanyAccessGate } from "@/components/company-access-gate";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalHome } from "@/routes/portal.index";
import { useTenant } from "@/hooks/use-tenant";
import { useTenantPwaManifest } from "@/hooks/use-tenant-pwa-manifest";
import { resolveCompanyPublic } from "@/lib/api/tenant";
import { markCustomerPortalMode } from "@/lib/portal-mode";
import { registerServiceWorker } from "@/lib/pwa";
import type { TenantBranding } from "@/lib/tenant";

/**
 * Permanent company website. The share link stays `/c/{slug}` on refresh.
 * Receivers open it in any browser — no app install required.
 */
export const Route = createFileRoute("/c/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Customer website — ${params.slug}` },
      {
        name: "description",
        content: "Public courier website — send and track parcels. Open to everyone with this link.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: CustomerTenantEntry,
});

function CustomerTenantEntry() {
  const { slug } = Route.useParams();
  const { activateTenant, updateTenant } = useTenant();
  useTenantPwaManifest();
  const [company, setCompany] = useState<TenantBranding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      markCustomerPortalMode(slug);
      const remote = await resolveCompanyPublic(slug);
      if (cancelled) return;

      if (!remote) {
        setError("This courier link is not valid. Ask the company for their official website link.");
        setReady(true);
        return;
      }

      setCompany(remote);
      updateTenant(remote);
      await activateTenant(remote.slug);
      document.title = `${remote.name} — Send & track parcels`;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, activateTenant, updateTenant]);

  if (error) {
    return (
      <div className="grid min-h-svh place-items-center bg-background px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-base font-semibold text-foreground">Courier not found</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="font-mono text-xs text-muted-foreground">/c/{slug}</p>
        </div>
      </div>
    );
  }

  if (ready && company && !error) {
    return (
      <CompanyAccessGate>
        <PortalShell>
          <PortalHome />
        </PortalShell>
      </CompanyAccessGate>
    );
  }

  const name = company?.name ?? "…";
  const initials =
    company?.logoInitials ??
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div
      className="grid min-h-svh place-items-center px-6 text-center"
      style={{
        background: company
          ? `linear-gradient(160deg, ${company.primaryColor} 0%, color-mix(in srgb, ${company.primaryColor} 55%, #0f172a) 100%)`
          : "var(--background)",
      }}
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-white">
        {company?.logoUrl ? (
          <img
            src={company.logoUrl}
            alt={name}
            className="h-24 w-24 rounded-2xl object-cover shadow-xl ring-2 ring-white/30"
          />
        ) : (
          <span className="grid h-24 w-24 place-items-center rounded-2xl bg-white/15 text-3xl font-bold shadow-xl ring-2 ring-white/30">
            {company ? initials : "…"}
          </span>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Official courier portal</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
          {company?.tagline ? <p className="mt-2 text-sm text-white/80">{company.tagline}</p> : null}
        </div>
        <p className="text-xs text-white/65">Opening {name}…</p>
      </div>
    </div>
  );
}
