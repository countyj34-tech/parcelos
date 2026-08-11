import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { isCompanyUuid } from "@/lib/api/company-brand";
import { resolveCompanyById, resolveCompanyPublic } from "@/lib/api/tenant";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  DEMO_TENANT,
  getActiveTenantSlug,
  resolveTenantFromHost,
  saveTenantOverrides,
  setActiveTenantSlug,
  type TenantBranding,
} from "@/lib/tenant";

type TenantContextValue = {
  tenant: TenantBranding;
  brandStyle: CSSProperties;
  updateTenant: (patch: Partial<TenantBranding>) => void;
  /** Switch active company brand (from `/c/{slug}` share links). */
  activateTenant: (slug: string) => Promise<boolean>;
  refreshTenant: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | null>(null);

function isDemoTenant(t: TenantBranding): boolean {
  return t.id === DEMO_TENANT.id || t.slug === DEMO_TENANT.slug;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { companyId, profile, isDemoMode, isLoading: authLoading } = useAuth();
  const [tenant, setTenant] = useState<TenantBranding>(() => resolveTenantFromHost());

  const refreshTenant = useCallback(async () => {
    // Prefer the signed-in company — never silently fall back to Swift demo.
    if (isSupabaseConfigured() && isCompanyUuid(companyId)) {
      const byId = await resolveCompanyById(companyId);
      if (byId) {
        setActiveTenantSlug(byId.slug);
        setTenant(byId);
        return;
      }
    }

    const slugFromProfile = profile?.companySlug?.trim().toLowerCase();
    const slug = slugFromProfile || getActiveTenantSlug();

    if (isSupabaseConfigured() && slug && slug !== DEMO_TENANT.slug) {
      const remote = await resolveCompanyPublic(slug);
      if (remote) {
        setActiveTenantSlug(remote.slug);
        setTenant(remote);
        return;
      }
    }

    if (isDemoMode) {
      setTenant(resolveTenantFromHost());
      return;
    }

    // Keep whatever we already have if remote lookup failed (don't wipe MTZ → Swift).
    setTenant((prev) => {
      if (!isDemoTenant(prev)) return prev;
      if (slugFromProfile && profile?.companyName) {
        return {
          ...DEMO_TENANT,
          id: companyId ?? prev.id,
          slug: slugFromProfile,
          name: profile.companyName,
          logoInitials: profile.companyName
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          domain: `${slugFromProfile}.parcelos.africa`,
        };
      }
      return prev;
    });
  }, [companyId, profile?.companySlug, profile?.companyName, isDemoMode]);

  useEffect(() => {
    if (authLoading && !isDemoMode) return;
    void refreshTenant();
  }, [refreshTenant, authLoading, isDemoMode]);

  const updateTenant = useCallback((patch: Partial<TenantBranding>) => {
    setTenant((prev) => {
      const next = { ...prev, ...patch };
      if (next.slug) setActiveTenantSlug(next.slug);
      if (!isSupabaseConfigured()) {
        saveTenantOverrides(next);
      }
      return next;
    });
  }, []);

  const activateTenant = useCallback(async (slug: string) => {
    const key = slug.trim().toLowerCase();
    setActiveTenantSlug(key);

    if (isSupabaseConfigured()) {
      const remote = await resolveCompanyPublic(key);
      if (remote) {
        setTenant(remote);
        return true;
      }
      // Don't revert to demo when slug is known but RPC isn't ready yet
      return false;
    }

    const local = resolveTenantFromHost();
    if (local.slug === key || key === DEMO_TENANT.slug) {
      setTenant({ ...DEMO_TENANT, ...local, slug: DEMO_TENANT.slug });
      return true;
    }
    return false;
  }, []);

  const brandStyle = useMemo(
    (): CSSProperties =>
      ({
        "--tenant-primary": tenant.primaryColor,
        "--tenant-primary-fg": tenant.primaryForeground,
        "--tenant-accent": tenant.accentColor,
      }) as CSSProperties,
    [tenant],
  );

  const value = useMemo(
    () => ({ tenant, brandStyle, updateTenant, activateTenant, refreshTenant }),
    [tenant, brandStyle, updateTenant, activateTenant, refreshTenant],
  );

  return (
    <TenantContext.Provider value={value}>
      <div style={brandStyle} className="tenant-branded flex min-h-full flex-col">
        {children}
      </div>
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
