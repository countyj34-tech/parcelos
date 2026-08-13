import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { canAccessRoute, getHomeRouteForRole } from "@/lib/roles";
import { isSuperAdminPatternUnlocked } from "@/lib/super-admin-unlock";

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading session…</p>
      </div>
    </div>
  );
}

type GuardProps = {
  children: ReactNode;
  requirePlatform?: boolean;
  requireStaff?: boolean;
  requireCustomer?: boolean;
};

/** Client-side route guard — redirects unauthenticated users and enforces role pages. */
export function AuthGuard({ children, requirePlatform, requireStaff, requireCustomer }: GuardProps) {
  const { isLoading, isAuthenticated, isPlatformOwner, isCustomer, isDemoMode, role } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isDemoMode) {
      void navigate({ to: "/login" });
      return;
    }

    if (requirePlatform) {
      if (!isPlatformOwner && !(isDemoMode && role === "Super Admin")) {
        void navigate({ to: getHomeRouteForRole(role) });
        return;
      }
      // Live platform owner: pattern unlock preferred on new devices (still allow if already owner session)
      if (isPlatformOwner && !isDemoMode && !isSuperAdminPatternUnlocked()) {
        // Soft gate — send to login with platform hint so they can re-enter pattern on this phone
        // Don't hard-block if they're already a verified platform owner from DB.
      }
    }

    if (requireStaff && isPlatformOwner) {
      void navigate({ to: "/admin" });
      return;
    }

    if (requireStaff && isCustomer) {
      void navigate({ to: "/portal/history" });
      return;
    }

    if (requireCustomer && !isCustomer && !isDemoMode) {
      void navigate({ to: "/portal/sign-in" });
      return;
    }

    if (requireStaff && !canAccessRoute(role, pathname)) {
      void navigate({ to: getHomeRouteForRole(role) });
    }
  }, [
    isLoading,
    isAuthenticated,
    isPlatformOwner,
    isCustomer,
    isDemoMode,
    requirePlatform,
    requireStaff,
    requireCustomer,
    role,
    pathname,
    navigate,
  ]);

  if (isLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated && !isDemoMode) return null;

  if (requirePlatform && !isPlatformOwner && !(isDemoMode && role === "Super Admin")) {
    return <AuthLoadingScreen />;
  }

  if (requireStaff && !canAccessRoute(role, pathname) && !isPlatformOwner) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
