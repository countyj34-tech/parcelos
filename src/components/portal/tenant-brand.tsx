import { Link } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { useTenant } from "@/hooks/use-tenant";
import { PLATFORM_OWNER } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { SecretLogoTap } from "@/components/secret-logo-tap";

export function TenantMark({
  size = "sm",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const { tenant } = useTenant();
  const dim = size === "lg" ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm";

  if (tenant.logoUrl) {
    return (
      <img
        src={tenant.logoUrl}
        alt={tenant.name}
        className={cn("rounded-xl object-cover shadow-lg ring-1 ring-white/20", dim, className)}
      />
    );
  }

  return (
    <span
      className={cn("grid place-items-center rounded-xl font-bold shadow-lg ring-1 ring-white/20", dim, className)}
      style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
    >
      {tenant.logoInitials}
    </span>
  );
}

export function TenantLogo({
  size = "lg",
  className,
  inverted = false,
}: {
  size?: "sm" | "lg";
  className?: string;
  inverted?: boolean;
}) {
  const { tenant } = useTenant();

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <TenantMark size={size} className={size === "lg" ? "rounded-2xl" : undefined} />
      <span
        className={cn(
          "font-display font-bold tracking-tight",
          size === "lg" ? "mt-4 text-2xl" : "mt-2 text-base",
          inverted ? "text-white" : "text-foreground",
        )}
      >
        {tenant.name}
      </span>
      {size === "lg" ? (
        <span className={cn("mt-1 text-sm", inverted ? "text-white/75" : "text-muted-foreground")}>
          {tenant.tagline}
        </span>
      ) : null}
    </div>
  );
}

export function TenantHeader({
  minimal = false,
  transparent = false,
  wide = false,
  compact = false,
}: {
  minimal?: boolean;
  transparent?: boolean;
  wide?: boolean;
  compact?: boolean;
}) {
  const { tenant } = useTenant();
  const maxW = wide ? "max-w-6xl" : "max-w-lg lg:max-w-3xl";

  const headerClass = transparent
    ? "relative z-20 shrink-0 border-b border-white/10 bg-black/20 backdrop-blur-md"
    : "border-b border-border/60 bg-background/90 backdrop-blur-xl";

  return (
    <header className={headerClass}>
      <div
        className={cn(
          "mx-auto flex items-center justify-between px-4 sm:px-8 lg:px-10",
          compact ? "py-2.5 sm:py-3" : "py-4",
          maxW,
        )}
        style={compact ? { paddingTop: "max(0.625rem, env(safe-area-inset-top))" } : undefined}
      >
        <div className="flex items-center gap-2.5 sm:gap-3">
          <SecretLogoTap>
            <TenantMark />
          </SecretLogoTap>
          <Link
            to="/portal"
            className={cn(
              "font-display font-bold",
              compact ? "text-sm sm:text-base" : "text-base sm:text-lg",
              transparent && "text-white",
            )}
          >
            {tenant.name}
          </Link>
        </div>
        <a
          href={`tel:${tenant.supportPhone.replace(/\s/g, "")}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:px-3.5 sm:py-2 sm:text-sm",
            transparent
              ? "border border-white/25 text-white/90 hover:bg-white/10"
              : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Phone className="h-3.5 w-3.5 sm:hidden" />
          <span className="sm:hidden">Call</span>
          <span className="hidden sm:inline">{tenant.supportPhone}</span>
        </a>
      </div>
    </header>
  );
}

export function TenantFooter({ onHero = false, compact = false }: { onHero?: boolean; compact?: boolean }) {
  return (
    <footer
      className={cn(
        "relative z-10 shrink-0 text-center",
        compact ? "py-3" : "py-6",
        onHero ? "border-t border-white/10" : "border-t border-border/60",
      )}
    >
      <p
        className={cn(
          "text-xs font-medium tracking-wide",
          onHero ? "text-white/60" : "text-muted-foreground",
        )}
      >
        {PLATFORM_OWNER}
      </p>
    </footer>
  );
}
