import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSecretAdminUnlock } from "@/hooks/use-secret-admin-unlock";
import { getSupabase } from "@/lib/supabase/client";
import { markSuperAdminDevice } from "@/lib/super-admin-unlock";
import { cn } from "@/lib/utils";

/** Invisible tap target on brand marks — unlocks platform console on any device. */
export function SecretLogoTap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const { setDemoRole, isDemoMode, isPlatformOwner, isAuthenticated } = useAuth();

  const unlock = useCallback(() => {
    markSuperAdminDevice();

    if (isDemoMode) {
      setDemoRole("Super Admin");
      toast.success("Platform console unlocked");
      void navigate({ to: "/admin", search: { section: "overview", company: undefined } });
      return;
    }

    if (isAuthenticated && isPlatformOwner) {
      toast.success("Opening platform console");
      void navigate({ to: "/admin", search: { section: "overview", company: undefined } });
      return;
    }

    const goPlatformLogin = async () => {
      // Soft sign-out so a courier session on this phone doesn't block owner login
      if (isAuthenticated) {
        const supabase = getSupabase();
        if (supabase) await supabase.auth.signOut();
      }
      toast.success("Pattern accepted", {
        description: "Sign in with your platform owner email & password.",
      });
      window.location.href = "/login?platform=1";
    };

    void goPlatformLogin();
  }, [isAuthenticated, isDemoMode, isPlatformOwner, navigate, setDemoRole]);

  const { onLogoTap } = useSecretAdminUnlock(unlock);

  return (
    <button
      type="button"
      aria-label="Brand"
      className={cn(
        "appearance-none border-0 bg-transparent p-0 text-left",
        "touch-manipulation select-none",
        // Larger invisible hit area on phones
        "min-h-11 min-w-11",
        className,
      )}
      style={{ WebkitTapHighlightColor: "transparent", WebkitUserSelect: "none" }}
      onClick={onLogoTap}
    >
      {children}
    </button>
  );
}

export {
  markSuperAdminDevice,
  isSuperAdminDevice,
  clearSuperAdminDevice,
  isSuperAdminPatternUnlocked,
  getPlatformOwnerLoginEmail,
} from "@/lib/super-admin-unlock";
