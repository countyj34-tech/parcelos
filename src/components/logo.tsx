import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";
import { SecretLogoTap } from "@/components/secret-logo-tap";

export function Logo({
  className,
  labelClassName,
  showPoweredBy = false,
}: {
  className?: string;
  labelClassName?: string;
  showPoweredBy?: boolean;
}) {
  return (
    <SecretLogoTap className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-card">
        <Package className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block font-display text-[17px] font-bold tracking-tight",
            labelClassName,
          )}
        >
          Parcel<span className="text-primary">OS</span>
        </span>
        {showPoweredBy ? (
          <span className="block truncate text-[10px] font-medium text-muted-foreground">
            Powered by {PLATFORM_OWNER}
          </span>
        ) : null}
      </span>
    </SecretLogoTap>
  );
}

export function PlatformBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {PLATFORM_OWNER}
    </span>
  );
}

export function ProductMeta(page: string) {
  return `${page} — ${PRODUCT_NAME}`;
}
