import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSecretAdminUnlock } from "@/hooks/use-secret-admin-unlock";
import { cn } from "@/lib/utils";

/** Logo pattern — SaaS Super Admin only. Opens /admin directly (no login). */
export function SecretLogoTap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const { enterSuperAdminConsole } = useAuth();

  const unlock = useCallback(() => {
    void (async () => {
      await enterSuperAdminConsole();
      toast.success("SaaS console opened", {
        description: "Companies, subscriptions, and billing — MTHUNZI-TECH-LABS only.",
      });
      void navigate({ to: "/admin", search: { section: "overview", company: undefined } });
    })();
  }, [enterSuperAdminConsole, navigate]);

  const { onLogoTap } = useSecretAdminUnlock(unlock);

  return (
    <button
      type="button"
      aria-label="Brand"
      className={cn(
        "appearance-none border-0 bg-transparent p-0 text-left",
        "touch-manipulation select-none",
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
