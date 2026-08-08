import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { demoProfile, loadAuthProfile, type AuthProfile } from "@/lib/auth/load-profile";
import { type UserRole, ROLE_USERS, getHomeRouteForRole } from "@/lib/roles";

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
      const loaded = await loadAuthProfile(nextSession);
      setProfile(loaded);
    } catch (err) {
      console.error("[AuthProvider] profile load failed:", err);
    }
  }, []);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s) void refreshProfile(s);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [isDemoMode, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (isDemoMode) {
      return { redirect: "/app", error: "Configure Supabase to use real authentication" };
    }

    const supabase = getSupabase();
    if (!supabase) return { redirect: "/login", error: "Supabase not available" };

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { redirect: "/login", error: error.message };

    if (data.session) {
      const loaded = await loadAuthProfile(data.session);
      setProfile(loaded);
      if (loaded.isPlatformOwner) return { redirect: "/admin" };
      if (loaded.isCustomer) return { redirect: "/portal/history" };
      return { redirect: getHomeRouteForRole(loaded.role) };
    }

    return { redirect: "/app" };
  }, [isDemoMode]);

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

    const env = import.meta.env.VITE_APP_URL ?? window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env}/login`,
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
      user: {
        name: profile?.fullName ?? ROLE_USERS[role].name,
        email: profile?.email ?? ROLE_USERS[role].email,
        initials: profile?.initials ?? ROLE_USERS[role].initials,
        branch: profile?.branch ?? ROLE_USERS[role].branch,
      },
      company: profile?.companyName ?? "Swift Logistics",
      companyId: profile?.companyId ?? null,
      signIn,
      signOut,
      resetPassword,
      setDemoRole,
    }),
    [session, isLoading, isDemoMode, profile, role, signIn, signOut, resetPassword, setDemoRole],
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
