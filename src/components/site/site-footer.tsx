import { Link } from "@tanstack/react-router";
import { CompanyBrand } from "@/components/site/company-brand";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <CompanyBrand showTagline />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Your courier operations platform — reception, dispatch, branches, finance and customer
              service in one secure workspace.
            </p>
            <div className="mt-5 flex gap-2">
              <Link
                to="/track"
                className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium transition-colors hover:bg-muted"
              >
                Track a parcel
              </Link>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{PRODUCT_NAME}</p>
            <p className="mt-1">Courier software — not a courier company.</p>
            <p className="mt-1">{PLATFORM_OWNER}</p>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {PRODUCT_NAME}. All rights reserved.</p>
          <p>Privacy · Terms · Data protection</p>
        </div>
      </div>
    </footer>
  );
}
