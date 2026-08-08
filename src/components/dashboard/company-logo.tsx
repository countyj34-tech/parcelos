import { Link } from "@tanstack/react-router";
import { DEMO_COMPANY } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { SecretLogoTap } from "@/components/secret-logo-tap";

export function CompanyLogo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <SecretLogoTap>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-card">
          SL
        </span>
      </SecretLogoTap>
      {!collapsed ? (
        <Link to="/app" className="min-w-0 font-display text-[16px] font-bold tracking-tight hover:opacity-90">
          {DEMO_COMPANY}
        </Link>
      ) : null}
    </div>
  );
}
