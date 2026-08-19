import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PLATFORM_TENANT } from "@/lib/tenant";
import { SecretLogoTap } from "@/components/secret-logo-tap";

/** Company-branded mark for public-facing pages (owner's system, not platform SaaS). */
export function CompanyBrand({
  className,
  showTagline = false,
  inverted = false,
}: {
  className?: string;
  showTagline?: boolean;
  inverted?: boolean;
}) {
  const t = PLATFORM_TENANT;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <SecretLogoTap>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold shadow-lg"
          style={{
            background: t.primaryColor,
            color: t.primaryForeground,
          }}
        >
          {t.logoInitials}
        </span>
      </SecretLogoTap>
      <Link to="/" className="min-w-0">
        <span
          className={cn(
            "block font-display text-lg font-bold tracking-tight",
            inverted ? "text-white" : "text-foreground",
          )}
        >
          {t.name}
        </span>
        {showTagline ? (
          <span className={cn("block text-xs", inverted ? "text-white/70" : "text-muted-foreground")}>
            {t.tagline}
          </span>
        ) : null}
      </Link>
    </div>
  );
}

export function CompanyMeta(page: string) {
  return `${page} — ${PLATFORM_TENANT.name}`;
}
