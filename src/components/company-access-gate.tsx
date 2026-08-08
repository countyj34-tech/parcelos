import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { isCompanyLockedRemote } from "@/lib/api/tenant";
import {
  getEffectiveCompanyStatus,
  isCompanyAccessBlocked,
  subscribeCompanyLifecycle,
} from "@/lib/company-lifecycle";
import { getCompanyBySlug } from "@/lib/platform-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Blocks company staff app + customer portal when paused/suspended. */
export function CompanyAccessGate({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant();
  const { isPlatformOwner } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [statusLabel, setStatusLabel] = useState("Suspended");
  const [ready, setReady] = useState(!isSupabaseConfigured());

  useEffect(() => {
    if (isPlatformOwner) {
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
      // UUID from Supabase; demo ids are not UUIDs
      const looksLikeUuid = /^[0-9a-f-]{36}$/i.test(tenant.id);
      if (looksLikeUuid) {
        const locked = await isCompanyLockedRemote(tenant.id);
        if (!cancelled && locked != null) {
          setBlocked(locked);
          setStatusLabel(locked ? "Suspended" : "Active");
          setReady(true);
          return;
        }
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
  }, [tenant.id, tenant.slug, isPlatformOwner]);

  if (!ready) {
    return (
      <div className="grid min-h-svh place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Checking company status…</p>
      </div>
    );
  }

  if (isPlatformOwner || !blocked) {
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
          This company workspace is temporarily unavailable. If you are a customer, contact the branch. If you run this
          company, settle your subscription or contact {tenant.supportEmail || "support"}.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">Status: {statusLabel}</p>
      </div>
    </div>
  );
}
