import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { AuthLoadingScreen } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";

/**
 * SaaS Super Admin only — opened via logo pattern, never company /login.
 */
export function SaasAdminGate({ children }: { children: ReactNode }) {
  const { isLoading, isSaasSuperAdmin, isDemoMode } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!isSaasSuperAdmin && !isDemoMode) {
      void navigate({ to: "/", replace: true });
    }
  }, [isLoading, isSaasSuperAdmin, isDemoMode, navigate]);

  if (isLoading) return <AuthLoadingScreen />;

  if (!isSaasSuperAdmin && !isDemoMode) {
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
            Courier company owners sign in at <span className="font-mono">/login</span> instead.
          </p>
          <Button asChild className="mt-6 w-full rounded-xl bg-teal-700 hover:bg-teal-600">
            <Link to="/">Go to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
