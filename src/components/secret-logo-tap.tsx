import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSecretAdminUnlock } from "@/hooks/use-secret-admin-unlock";
import { markSuperAdminDevice } from "@/lib/super-admin-unlock";
import { cn } from "@/lib/utils";

/** Logo pattern — SaaS Super Admin only. Opens /admin (two-step login after pattern). */
export function SecretLogoTap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const { enterSuperAdminConsole } = useAuth();
  const lastPointerAt = useRef(0);

  const unlock = useCallback(() => {
    void (async () => {
      try {
        markSuperAdminDevice();
        await enterSuperAdminConsole();
      } catch (err) {
        console.error("[SecretLogoTap]", err);
      }
      toast.success("Owner console", {
        description: "Sign in with your two owner accounts to continue.",
      });
      void navigate({ to: "/admin", search: { section: "overview", company: undefined } });
    })();
  }, [enterSuperAdminConsole, navigate]);

  const { registerTap } = useSecretAdminUnlock(unlock);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      const now = Date.now();
      if (now - lastPointerAt.current < 80) return;
      lastPointerAt.current = now;
      e.preventDefault();
      registerTap();
    },
    [registerTap],
  );

  return (
    <button
      type="button"
      aria-label="Brand"
      className={cn(
        "appearance-none border-0 bg-transparent p-0 text-left",
        "touch-manipulation select-none cursor-pointer",
        "min-h-11 min-w-11",
        className,
      )}
      style={{ WebkitTapHighlightColor: "transparent", WebkitUserSelect: "none", touchAction: "manipulation" }}
      onPointerDown={handlePointerDown}
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
