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
  PLATFORM_TENANT,
  getActiveTenantSlug,
  isPlaceholderTenant,
  readLastLiveTenant,
  saveLastLiveTenant,
  saveTenantOverrides,
  setActiveTenantSlug,
  type TenantBranding,
} from "@/lib/tenant";
import { isBrowserOffline, withTimeout } from "@/lib/offline";

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
  return isPlaceholderTenant(t);
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { companyId, profile, isDemoMode, isLoading: authLoading } = useAuth();
  const [tenant, setTenant] = useState<TenantBranding>(() => {
    const last = readLastLiveTenant();
    if (last && !isPlaceholderTenant(last)) return last;
    return PLATFORM_TENANT;
  });

  const refreshTenant = useCallback(async () => {
    if (isBrowserOffline()) {
      const last = readLastLiveTenant();
      if (last) {
        setActiveTenantSlug(last.slug);
        setTenant(last);
      }
      return;
    }

    // Prefer the signed-in company — never silently fall back to Swift demo.
    if (isSupabaseConfigured() && isCompanyUuid(companyId)) {
      try {
        const byId = await withTimeout(resolveCompanyById(companyId), 4000, "tenant-id");
        if (byId) {
          setActiveTenantSlug(byId.slug);
          saveLastLiveTenant(byId);
          setTenant(byId);
          return;
        }
      } catch {
        const last = readLastLiveTenant();
        if (last) {
          setActiveTenantSlug(last.slug);
          setTenant(last);
          return;
        }
      }
    }

    const slugFromProfile = profile?.companySlug?.trim().toLowerCase();
    const slug = slugFromProfile || getActiveTenantSlug();

    if (isSupabaseConfigured() && slug && slug !== PLATFORM_TENANT.slug) {
      try {
        const remote = await withTimeout(resolveCompanyPublic(slug), 4000, "tenant-slug");
        if (remote) {
          setActiveTenantSlug(remote.slug);
          saveLastLiveTenant(remote);
          setTenant(remote);
          return;
        }
      } catch {
        const last = readLastLiveTenant();
        if (last) {
          setActiveTenantSlug(last.slug);
          setTenant(last);
          return;
        }
      }
    }

    if (isDemoMode) {
      setTenant(DEMO_TENANT);
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
        saveLastLiveTenant(remote);
        return true;
      }
      // Don't revert to demo when slug is known but RPC isn't ready yet
      return false;
    }

    if (key === DEMO_TENANT.slug) {
      setTenant(DEMO_TENANT);
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
