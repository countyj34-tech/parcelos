import { useEffect, useMemo, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/use-tenant";
import { isCustomerPortalMode } from "@/lib/portal-mode";
import { registerServiceWorker } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

/**
 * Always visible on shared customer portal links (unless dismissed / already installed).
 * Uses native install prompt when the browser supports it; otherwise shows how-to steps.
 */
export function PwaInstallPrompt({
  title,
  description,
  force = false,
}: {
  title?: string;
  description?: string;
  /** Show even outside customer portal mode (e.g. staff preview). */
  force?: boolean;
} = {}) {
  const { tenant } = useTenant();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const label = title ?? tenant.name;
  const dismissKey = useMemo(() => `parcelos-install-dismiss:${tenant.slug}`, [tenant.slug]);

  const copy =
    description ??
    `Install ${label} on your phone — home screen icon with your courier logo. Also available as ParcelOS on the App Store and Google Play.`;

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    try {
      if (sessionStorage.getItem(dismissKey) === "1") setDismissed(true);
    } catch {
      /* ignore */
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissKey]);

  const customerMode = force || isCustomerPortalMode();
  if (installed || dismissed || !customerMode) return null;

  const onDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {
      /* ignore */
    }
  };

  const onInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      setDeferred(null);
      if (choice?.outcome === "accepted") setInstalled(true);
      return;
    }
    if (isIos()) {
      setIosHelp(true);
      return;
    }
    // Desktop / Android without native prompt — open browser install menu hint
    setIosHelp(true);
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lift">
        <div className="flex items-start gap-3">
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={label}
              className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-bold"
              style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
            >
              {tenant.logoInitials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Install {label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{copy}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {iosHelp ? (
          <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            {isIos() ? (
              <p>
                Tap <Share className="mx-0.5 inline h-3.5 w-3.5" /> <strong>Share</strong>, then{" "}
                <strong>Add to Home Screen</strong>. You&apos;ll see the {label} logo on your phone.
              </p>
            ) : (
              <p>
                Use your browser menu → <strong>Install app</strong> / <strong>Add to Home screen</strong>.
                On phones this works best in Chrome over HTTPS. The home-screen icon uses the {label} logo.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="rounded-xl"
            style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
            onClick={() => void onInstall()}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> {deferred ? "Install app" : "How to install"}
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl" onClick={onDismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
