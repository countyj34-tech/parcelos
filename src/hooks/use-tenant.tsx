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
import { resolveCompanyPublic } from "@/lib/api/tenant";
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

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantBranding>(() => resolveTenantFromHost());

  const refreshTenant = useCallback(async () => {
    const slug = getActiveTenantSlug();
    if (isSupabaseConfigured()) {
      const remote = await resolveCompanyPublic(slug);
      if (remote) {
        setTenant(remote);
        return;
      }
    }
    setTenant(resolveTenantFromHost());
  }, []);

  useEffect(() => {
    void refreshTenant();
  }, [refreshTenant]);

  const updateTenant = useCallback((patch: Partial<TenantBranding>) => {
    setTenant((prev) => {
      const next = { ...prev, ...patch };
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
