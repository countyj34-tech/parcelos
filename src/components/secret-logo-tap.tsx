import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSecretAdminUnlock } from "@/hooks/use-secret-admin-unlock";
import { cn } from "@/lib/utils";

const DEVICE_KEY = "parcelos-super-admin-device";

export function markSuperAdminDevice() {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEVICE_KEY, "1");
}

export function isSuperAdminDevice() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEVICE_KEY) === "1";
}

export function clearSuperAdminDevice() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEVICE_KEY);
}

/** Invisible tap target on brand marks — unlocks platform console. */
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
      toast.success("Platform console unlocked", {
        description: "Install this app to keep Super Admin on this device.",
      });
      void navigate({ to: "/admin", search: { section: "overview", company: undefined } });
      return;
    }

    if (isAuthenticated && isPlatformOwner) {
      toast.success("Opening platform console");
      void navigate({ to: "/admin", search: { section: "overview", company: undefined } });
      return;
    }

    toast.message("Sign in as platform owner", {
      description: "Use your Mthunzi-Tech-Labs account to open the console.",
    });
    void navigate({ to: "/login" });
  }, [isAuthenticated, isDemoMode, isPlatformOwner, navigate, setDemoRole]);

  const { onLogoTap } = useSecretAdminUnlock(unlock);

  return (
    <button
      type="button"
      aria-label="Brand"
      className={cn("appearance-none border-0 bg-transparent p-0 text-left", className)}
      onClick={onLogoTap}
    >
      {children}
    </button>
  );
}
