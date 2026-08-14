import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { AuthLoadingScreen } from "@/components/auth/auth-guard";
import { SaasAdminLogin } from "@/components/auth/saas-admin-login";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";
import { isSuperAdminPatternUnlocked } from "@/lib/super-admin-unlock";

/**
 * SaaS Super Admin only — logo pattern + two-step owner login.
 */
export function SaasAdminGate({ children }: { children: ReactNode }) {
  const { isLoading, isSaasSuperAdmin, isDemoMode } = useAuth();
  const patternUnlocked =
    typeof window !== "undefined" ? isSuperAdminPatternUnlocked() : false;

  if (isLoading) return <AuthLoadingScreen />;

  if (!patternUnlocked && !isDemoMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/95 p-8 text-center shadow-2xl">
          <Shield className="mx-auto h-10 w-10 text-teal-700" />
          <h1 className="mt-4 font-display text-xl font-bold">SaaS owner access only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {PRODUCT_NAME} platform console ({PLATFORM_OWNER}) opens with the logo tap pattern on the home
            screen — not company login.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Pattern: 2 taps → pause → 4 → pause → 7 → pause → 1 on the ParcelOS logo.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            After the pattern you will sign in twice with owner credentials.
          </p>
          <Button asChild className="mt-6 w-full rounded-xl bg-teal-700 hover:bg-teal-600">
            <Link to="/">Go to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!isSaasSuperAdmin && !isDemoMode) {
    return <SaasAdminLogin />;
  }

  return <>{children}</>;
}
