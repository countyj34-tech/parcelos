import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured, getAuthRedirectPath } from "@/lib/supabase/config";
import { demoProfile, loadAuthProfile, type AuthProfile } from "@/lib/auth/load-profile";
import { registerCourierCompany } from "@/lib/api/signup";
import { type UserRole, ROLE_USERS, getHomeRouteForRole } from "@/lib/roles";

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "User";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "User";
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const DEMO_ROLE_KEY = "parcelos-role";
const SUPER_ADMIN_DEVICE_KEY = "parcelos-super-admin-device";

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  isPlatformOwner: boolean;
  isCustomer: boolean;
  profile: AuthProfile | null;
  role: UserRole;
  user: { name: string; email: string; initials: string; branch: string };
  company: string;
  companyId: string | null;
  signIn: (email: string, password: string) => Promise<{ redirect: string; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  setDemoRole: (role: UserRole) => void;
  refreshProfileAfterAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readDemoRole(): UserRole {
  if (typeof window === "undefined") return "Company Admin";
  try {
    if (localStorage.getItem(SUPER_ADMIN_DEVICE_KEY) === "1") {
      return "Super Admin";
    }
    const stored = localStorage.getItem(DEMO_ROLE_KEY) ?? sessionStorage.getItem(DEMO_ROLE_KEY);
    if (stored && stored in ROLE_USERS) return stored as UserRole;
  } catch {
    /* ignore */
  }
  return "Company Admin";
}

/** After email confirmation / first login — finish company provisioning from signup metadata. */
async function ensureCompanyWorkspace(session: Session, profile: AuthProfile): Promise<AuthProfile> {
  if (profile.isPlatformOwner || profile.isCustomer) return profile;

  const supabase = getSupabase();
  if (supabase && !profile.companyId) {
    try {
      await supabase.rpc("repair_my_company_link");
      const repaired = await loadAuthProfile(session);
      if (repaired.companyId) return repaired;
    } catch {
      /* migration 25 optional */
    }
  }

  if (profile.companyId) return profile;

  const meta = session.user.user_metadata ?? {};
  const companyName = typeof meta.company_name === "string" ? meta.company_name.trim() : "";
  if (!companyName) return profile;

  try {
    await registerCourierCompany({
      companyName,
      fullName: typeof meta.full_name === "string" ? meta.full_name : profile.fullName,
      email: session.user.email ?? profile.email,
      phone: typeof meta.phone === "string" ? meta.phone : undefined,
    });
    const next = await loadAuthProfile(session);
    try {
      if (supabase && next.companyId) {
        await supabase.rpc("notify_company_welcome", {
          p_company_id: next.companyId,
          p_user_id: session.user.id,
        });
      }
    } catch {
      /* optional until migration 24 */
    }
    return next;
  } catch (err) {
    console.error("[AuthProvider] register company failed:", err);
    return profile;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isDemoMode = !isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(() =>
    isDemoMode ? demoProfile(readDemoRole()) : null,
  );
  const [isLoading, setIsLoading] = useState(!isDemoMode);

  const refreshProfile = useCallback(async (nextSession: Session) => {
    try {
      let loaded = await loadAuthProfile(nextSession);
      loaded = await ensureCompanyWorkspace(nextSession, loaded);
      setProfile(loaded);
      return loaded;
    } catch (err) {
      console.error("[AuthProvider] profile load failed:", err);
      return null;
    }
  }, []);

  const refreshProfileAfterAuth = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      await refreshProfile(data.session);
    }
  }, [refreshProfile]);

  useEffect(() => {
    if (isDemoMode) {
      setIsLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s) void refreshProfile(s).finally(() => setIsLoading(false));
      else setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s) void refreshProfile(s);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [isDemoMode, refreshProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (isDemoMode) {
        return { redirect: "/app", error: "Configure Supabase to use real authentication" };
      }

      const supabase = getSupabase();
      if (!supabase) return { redirect: "/login", error: "Supabase not available" };

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { redirect: "/login", error: error.message };

      if (data.session) {
        const loaded = await refreshProfile(data.session);
        if (!loaded) return { redirect: "/app/onboarding" };
        if (loaded.isPlatformOwner) return { redirect: "/admin" };
        if (loaded.isCustomer) return { redirect: "/portal/history" };
        if (!loaded.companyId) return { redirect: "/app/onboarding" };
        return { redirect: getHomeRouteForRole(loaded.role) };
      }

      return { redirect: "/app" };
    },
    [isDemoMode, refreshProfile],
  );

  const signOut = useCallback(async () => {
    if (isDemoMode) {
      sessionStorage.removeItem(DEMO_ROLE_KEY);
      localStorage.removeItem(DEMO_ROLE_KEY);
      localStorage.removeItem(SUPER_ADMIN_DEVICE_KEY);
      setProfile(demoProfile("Company Admin"));
      window.location.href = "/login";
      return;
    }

    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  }, [isDemoMode]);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: "Supabase not configured" };

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectPath("/login"),
    });

    return error ? { error: error.message } : {};
  }, []);

  const setDemoRole = useCallback((role: UserRole) => {
    localStorage.setItem(DEMO_ROLE_KEY, role);
    sessionStorage.setItem(DEMO_ROLE_KEY, role);
    if (role === "Super Admin") {
      localStorage.setItem(SUPER_ADMIN_DEVICE_KEY, "1");
    }
    setProfile(demoProfile(role));
  }, []);

  const role = profile?.role ?? "Company Admin";
  const sessionEmail = session?.user?.email ?? user?.email ?? "";
  const liveName =
    profile?.fullName ||
    (typeof session?.user?.user_metadata?.full_name === "string"
      ? session.user.user_metadata.full_name
      : "") ||
    (sessionEmail ? nameFromEmail(sessionEmail) : "");

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isAuthenticated: isDemoMode ? true : Boolean(session),
      isDemoMode,
      isPlatformOwner: profile?.isPlatformOwner ?? false,
      isCustomer: profile?.isCustomer ?? false,
      profile,
      role,
      user: isDemoMode
        ? {
            name: profile?.fullName ?? ROLE_USERS[role].name,
            email: profile?.email ?? ROLE_USERS[role].email,
            initials: profile?.initials ?? ROLE_USERS[role].initials,
            branch: profile?.branch ?? ROLE_USERS[role].branch,
          }
        : {
            name: liveName || "User",
            email: profile?.email || sessionEmail || "",
            initials: profile?.initials || initialsFrom(liveName || "U"),
            branch: profile?.branch || "All Branches",
          },
      company: isDemoMode
        ? (profile?.companyName ?? "Swift Logistics")
        : (profile?.companyName ?? "Your company"),
      companyId: profile?.companyId ?? null,
      signIn,
      signOut,
      resetPassword,
      setDemoRole,
      refreshProfileAfterAuth,
    }),
    [
      session,
      user,
      sessionEmail,
      liveName,
      isLoading,
      isDemoMode,
      profile,
      role,
      signIn,
      signOut,
      resetPassword,
      setDemoRole,
      refreshProfileAfterAuth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** @deprecated Use setDemoRole via useAuth */
export function storeLoginRole(role: UserRole) {
  localStorage.setItem(DEMO_ROLE_KEY, role);
  sessionStorage.setItem(DEMO_ROLE_KEY, role);
}
