import { useEffect } from "react";
import { useTenant } from "@/hooks/use-tenant";

/**
 * Replace the document manifest (and apple-touch-icon) so "Add to Home Screen"
 * uses this company's name + logo.
 */
export function useTenantPwaManifest() {
  const { tenant } = useTenant();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const iconSrc = tenant.logoUrl || "/icons/icon-512.svg";
    const manifest = {
      name: tenant.name,
      short_name: tenant.name.slice(0, 12),
      description: tenant.tagline || `Send and track parcels with ${tenant.name}`,
      start_url: `/c/${tenant.slug}`,
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: tenant.primaryColor,
      orientation: "portrait-primary",
      icons: [
        {
          src: iconSrc,
          sizes: "192x192",
          type: iconSrc.endsWith(".svg") ? "image/svg+xml" : "image/png",
          purpose: "any",
        },
        {
          src: iconSrc,
          sizes: "512x512",
          type: iconSrc.endsWith(".svg") ? "image/svg+xml" : "image/png",
          purpose: "any maskable",
        },
      ],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const url = URL.createObjectURL(blob);

    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = url;

    let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      document.head.appendChild(apple);
    }
    apple.href = iconSrc;

    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (theme) theme.content = tenant.primaryColor;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [tenant]);
}
