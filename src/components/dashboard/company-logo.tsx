import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { getHomeRouteForRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { SecretLogoTap } from "@/components/secret-logo-tap";

export function CompanyLogo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const { role } = useAuth();
  const { tenant } = useTenant();
  const home = getHomeRouteForRole(role);
  const initials = tenant.logoInitials || tenant.name.slice(0, 2).toUpperCase();

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <SecretLogoTap>
        {tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover shadow-card" />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-card">
            {initials}
          </span>
        )}
      </SecretLogoTap>
      {!collapsed ? (
        <Link to={home} className="min-w-0 font-display text-[16px] font-bold tracking-tight hover:opacity-90">
          {tenant.name}
        </Link>
      ) : null}
    </div>
  );
}
