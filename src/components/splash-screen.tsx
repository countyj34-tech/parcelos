import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type SplashVariant = "company" | "admin" | "auto";

type SplashScreenProps = {
  variant?: SplashVariant;
  /** Optional company / console name under the product mark */
  title?: string;
  subtitle?: string;
  /** Compact overlay for in-app page transitions */
  overlay?: boolean;
  className?: string;
};

function resolveVariant(variant: SplashVariant, pathname: string): "company" | "admin" {
  if (variant === "admin" || variant === "company") return variant;
  if (pathname.startsWith("/admin") || pathname.startsWith("/platform")) return "admin";
  return "company";
}

/**
 * Branded splash for refresh, session load, and page transitions.
 * Company desk = teal; SaaS console = deep slate.
 */
export function SplashScreen({
  variant = "auto",
  title,
  subtitle,
  overlay = false,
  className,
}: SplashScreenProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mode = resolveVariant(variant, pathname);
  const isAdmin = mode === "admin";

  const heading = PRODUCT_NAME;
  const line =
    subtitle ??
    (isAdmin ? `${PLATFORM_OWNER} · Platform console` : "Courier operations · ready when you are");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden",
        overlay ? "fixed inset-0 z-[80]" : "min-h-dvh w-full",
        isAdmin ? "bg-slate-950 text-white" : "bg-[#062a28] text-white",
        className,
      )}
    >
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isAdmin
            ? "radial-gradient(70% 55% at 50% 35%, rgba(15,118,110,0.45), transparent 70%), radial-gradient(50% 40% at 80% 10%, rgba(45,212,191,0.12), transparent 60%), linear-gradient(180deg, #020617 0%, #0f172a 55%, #020617 100%)"
            : "radial-gradient(65% 50% at 50% 40%, rgba(20,184,166,0.35), transparent 68%), radial-gradient(45% 35% at 15% 85%, rgba(245,158,11,0.12), transparent 55%), linear-gradient(165deg, #041f1d 0%, #0F766E 48%, #083532 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] splash-grid" />

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <div className="splash-mark relative mb-7">
          <span className="splash-ring absolute -inset-3 rounded-[1.35rem]" aria-hidden />
          <span
            className={cn(
              "relative grid h-16 w-16 place-items-center rounded-[1.15rem] text-2xl font-bold shadow-2xl sm:h-[4.5rem] sm:w-[4.5rem] sm:text-3xl",
              isAdmin ? "bg-teal-600 text-white" : "bg-white text-teal-800",
            )}
          >
            P
          </span>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title ?? heading}</h1>
        {isAdmin ? (
          <p className="mt-1 font-display text-lg font-semibold tracking-tight text-teal-300/90">
            Console
          </p>
        ) : null}

        <p className="mt-3 max-w-xs text-sm text-white/65 sm:text-[15px]">{line}</p>

        <div className="mt-10 h-1 w-40 overflow-hidden rounded-full bg-white/15 sm:w-48">
          <div className="splash-bar h-full rounded-full bg-gradient-to-r from-teal-300 via-white to-amber-200" />
        </div>
      </div>
    </div>
  );
}

/** Full-screen splash while auth / session boots (refresh). */
export function AuthLoadingScreen() {
  return <SplashScreen />;
}

/**
 * Soft flash overlay when navigating between pages.
 * Shows briefly so transitions feel intentional on phone and desktop.
 */
export function RouteSplashOverlay() {
  const status = useRouterState({ select: (s) => s.status });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "pending") {
      setVisible(true);
      return;
    }
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), 220);
    return () => window.clearTimeout(t);
  }, [status, visible]);

  if (!visible) return null;

  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/platform");

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[80] flex items-center justify-center transition-opacity duration-200",
        status === "pending" ? "opacity-100" : "opacity-0",
      )}
      aria-hidden={status !== "pending"}
    >
      <div
        className={cn(
          "absolute inset-0 backdrop-blur-[2px]",
          isAdmin ? "bg-slate-950/55" : "bg-[#062a28]/45",
        )}
      />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="splash-mark relative">
          <span className="splash-ring absolute -inset-2 rounded-2xl" aria-hidden />
          <span
            className={cn(
              "relative grid h-12 w-12 place-items-center rounded-xl text-lg font-bold shadow-lg",
              isAdmin ? "bg-teal-600 text-white" : "bg-white text-teal-800",
            )}
          >
            P
          </span>
        </div>
        <div className="h-0.5 w-28 overflow-hidden rounded-full bg-white/20">
          <div className="splash-bar h-full rounded-full bg-gradient-to-r from-teal-300 via-white to-amber-200" />
        </div>
      </div>
    </div>
  );
}
