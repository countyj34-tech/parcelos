import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { TenantFooter, TenantHeader } from "@/components/portal/tenant-brand";
import { PwaInstallPrompt } from "@/components/portal/pwa-install-prompt";
import { useTenant } from "@/hooks/use-tenant";

function isCompanyHomePath(pathname: string) {
  return pathname === "/portal" || pathname === "/portal/" || /^\/c\/[^/]+\/?$/.test(pathname);
}

const FULL_PAGE_ROUTES = new Set(["/portal/sign-in", "/portal/register"]);

export function PortalShell({
  children,
  minimalHeader = false,
}: {
  children: ReactNode;
  minimalHeader?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { tenant } = useTenant();

  if (FULL_PAGE_ROUTES.has(pathname)) {
    return (
      <>
        {children}
        <PwaInstallPrompt />
      </>
    );
  }

  if (isCompanyHomePath(pathname)) {
    return (
      <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden">
        <img
          src={tenant.heroImageUrl}
          alt=""
          className="absolute left-0 top-0 h-[145%] w-full object-cover object-[50%_32%] max-md:-translate-y-[18%] md:inset-0 md:h-full md:translate-y-0 md:object-[center_28%]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.18) 16%, rgba(0,0,0,0.35) 42%, color-mix(in srgb, var(--tenant-primary) 22%, transparent) 62%, rgba(0,0,0,0.88) 100%)",
          }}
        />

        <TenantHeader transparent wide compact />
        <main className="relative z-10 mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col px-4 sm:px-6 lg:max-w-6xl lg:px-10">
          {children}
        </main>
        <PwaInstallPrompt />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TenantHeader minimal={minimalHeader} wide />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 sm:py-10 lg:max-w-4xl">
        {children}
      </main>
      <TenantFooter />
      <PwaInstallPrompt />
    </div>
  );
}
