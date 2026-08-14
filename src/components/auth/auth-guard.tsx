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

/** Client-side route guard — company staff vs SaaS super admin stay separate. */
export function AuthGuard({ children, requirePlatform, requireStaff, requireCustomer }: GuardProps) {
  const { isLoading, isAuthenticated, isSaasSuperAdmin, isCustomer, isDemoMode, role } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isLoading) return;

    // SaaS console — logo pattern only
    if (requirePlatform && !isSaasSuperAdmin) {
      void navigate({ to: "/", replace: true });
      return;
    }

    // Company workspace — not for SaaS super admin session
    if (requireStaff && isSaasSuperAdmin) {
      void navigate({ to: "/admin", search: { section: "overview", company: undefined } });
      return;
    }

    if (!isAuthenticated && !isDemoMode && !requirePlatform) {
      void navigate({ to: "/login" });
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
    isSaasSuperAdmin,
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

  if (requirePlatform && !isSaasSuperAdmin) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated && !isDemoMode && !requirePlatform) return null;

  if (requireStaff && !canAccessRoute(role, pathname) && !isSaasSuperAdmin) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
