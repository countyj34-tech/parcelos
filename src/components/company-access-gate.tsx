import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CreditCard, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { fetchCompanyBilling } from "@/lib/api/billing";
import { isCompanyLockedRemote } from "@/lib/api/tenant";
import {
  getEffectiveCompanyStatus,
  isCompanyAccessBlocked,
  subscribeCompanyLifecycle,
} from "@/lib/company-lifecycle";
import { getCompanyBySlug } from "@/lib/platform-data";
import { isCustomerPortalMode } from "@/lib/portal-mode";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const BILLING_ESCAPE = ["/app/subscription", "/app/support", "/login", "/signup"];

/** Blocks company staff app + customer portal when paused/suspended/expired — allows billing escape hatch. */
export function CompanyAccessGate({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant();
  const { isSaasSuperAdmin, role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [blocked, setBlocked] = useState(false);
  const [statusLabel, setStatusLabel] = useState("Suspended");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured());

  const onBillingPath = BILLING_ESCAPE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const canPay = role === "Company Admin" || role === "Branch Manager" || role === "Finance";

  useEffect(() => {
    if (isSaasSuperAdmin) {
      setBlocked(false);
      setReady(true);
      return;
    }

    let cancelled = false;

    const checkLocal = () => {
      const company = getCompanyBySlug(tenant.slug);
      const status = getEffectiveCompanyStatus(tenant.slug, company?.status ?? "Active");
      if (!cancelled) {
        setStatusLabel(String(status));
        setBlocked(isCompanyAccessBlocked(String(status)));
        setReady(true);
      }
    };

    const checkRemote = async () => {
      const looksLikeUuid = /^[0-9a-f-]{36}$/i.test(tenant.id);
      // Customer share-link portal: only lock when the remote lock check says so
      const customerPortal = isCustomerPortalMode();
      if (looksLikeUuid) {
        if (customerPortal) {
          const locked = await isCompanyLockedRemote(tenant.id);
          if (!cancelled) {
            setBlocked(Boolean(locked));
            setStatusLabel(locked ? "Suspended" : "Active");
            setReady(true);
            return;
          }
        }
        const [locked, billing] = await Promise.all([
          isCompanyLockedRemote(tenant.id),
          fetchCompanyBilling(),
        ]);
        if (!cancelled) {
          if (billing) {
            setDaysLeft(billing.daysLeft);
            setStatusLabel(
              billing.locked
                ? billing.companyStatus === "trial"
                  ? "Expired"
                  : billing.companyStatus
                : billing.companyStatus,
            );
            setBlocked(billing.locked);
            setReady(true);
            return;
          }
          if (locked != null) {
            setBlocked(locked);
            setStatusLabel(locked ? "Suspended" : "Active");
            setReady(true);
            return;
          }
        }
      }
      // Fail closed for unknown live companies — do not open access when status is unknown
      if (looksLikeUuid) {
        if (!cancelled) {
          setBlocked(true);
          setStatusLabel("Unavailable");
          setReady(true);
        }
        return;
      }
      checkLocal();
    };

    if (isSupabaseConfigured()) {
      void checkRemote();
    } else {
      checkLocal();
      return subscribeCompanyLifecycle(checkLocal);
    }

    return () => {
      cancelled = true;
    };
  }, [tenant.id, tenant.slug, isSaasSuperAdmin]);

  if (!ready) {
    return (
      <div className="grid min-h-svh place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Checking company status…</p>
      </div>
    );
  }

  if (isSaasSuperAdmin || !blocked || (onBillingPath && canPay)) {
    return <>{children}</>;
  }

  const label = statusLabel.toLowerCase();

  return (
    <div className="grid min-h-svh place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldOff className="h-7 w-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">
          {tenant.name} is {label}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your 14-day free trial ended or the subscription is inactive. Pay with Mobile Money (GenesysPay) to reopen the
          portal for your customers.
        </p>
        {daysLeft === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Trial ended — subscribe to reopen the desk.</p>
        ) : null}
        {canPay ? (
          <Button asChild className="mt-6 rounded-xl">
            <Link to="/app/subscription">
                <CreditCard className="mr-2 h-4 w-4" /> Pay with Mobile Money
            </Link>
          </Button>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Ask your company admin to renew on Subscription.</p>
        )}
        <p className="mt-6 text-xs text-muted-foreground">Status: {statusLabel}</p>
      </div>
    </div>
  );
}
