import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { canAccessRoute, getHomeRouteForRole } from "@/lib/roles";

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

    if (requirePlatform && !isPlatformOwner) {
      void navigate({ to: getHomeRouteForRole(role) });
      return;
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

  if (requireStaff && !canAccessRoute(role, pathname) && !isPlatformOwner) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
