import { useTenant } from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";
import { SecretLogoTap } from "@/components/secret-logo-tap";

export function CompanyLogo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const { tenant } = useTenant();
  const initials = tenant.logoInitials || tenant.name.slice(0, 2).toUpperCase();

  return (
    <SecretLogoTap className={cn("flex items-center gap-2.5", className)}>
      {tenant.logoUrl ? (
        <img src={tenant.logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover shadow-card" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-card">
          {initials}
        </span>
      )}
      {!collapsed ? (
        <span className="min-w-0 font-display text-[16px] font-bold tracking-tight">{tenant.name}</span>
      ) : null}
    </SecretLogoTap>
  );
}
