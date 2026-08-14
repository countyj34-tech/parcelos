import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { canAccessRoute, getHomeRouteForRole, type UserRole } from "@/lib/roles";
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

function canAccessPlatformConsole(isPlatformOwner: boolean, isDemoMode: boolean, role: UserRole) {
  return (
    isPlatformOwner ||
    isSuperAdminPatternUnlocked() ||
    (isDemoMode && role === "Super Admin")
  );
}

/** Client-side route guard — redirects unauthenticated users and enforces role pages. */
export function AuthGuard({ children, requirePlatform, requireStaff, requireCustomer }: GuardProps) {
  const { isLoading, isAuthenticated, isPlatformOwner, isCustomer, isDemoMode, role } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isLoading) return;

    const saasConsole = canAccessPlatformConsole(isPlatformOwner, isDemoMode, role);

    if (!isAuthenticated && !isDemoMode && !saasConsole) {
      void navigate({ to: "/login" });
      return;
    }

    if (requirePlatform && !saasConsole) {
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

  const saasConsole = canAccessPlatformConsole(isPlatformOwner, isDemoMode, role);

  if (!isAuthenticated && !isDemoMode && !saasConsole) return null;

  if (requirePlatform && !saasConsole) {
    return <AuthLoadingScreen />;
  }

  if (requireStaff && !canAccessRoute(role, pathname) && !isPlatformOwner) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
