import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/use-tenant";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallPrompt({
  title,
  description = "Add to your home screen for a full-screen app experience.",
}: {
  title?: string;
  description?: string;
} = {}) {
  const { tenant } = useTenant();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const label = title ?? tenant.name;

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed || dismissed || !deferred) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-lift">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
          style={{ background: "var(--tenant-primary)" }}
        >
          {tenant.logoInitials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Install {label}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="rounded-xl"
              style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
              onClick={async () => {
                await deferred.prompt();
                setDeferred(null);
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Install app
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setDismissed(true)}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
