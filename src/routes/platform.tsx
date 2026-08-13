import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, Mail, Shield } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";
import {
  getPlatformOwnerLoginEmail,
  isSuperAdminPatternUnlocked,
  markSuperAdminDevice,
} from "@/lib/super-admin-unlock";
import { toast } from "sonner";

/**
 * Hidden platform-owner sign-in.
 * Not linked from marketing — only after the logo pattern on any device.
 * Company staff use /login instead.
 */
export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title: `Platform — ${PRODUCT_NAME}` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PlatformLoginPage,
});

function PlatformLoginPage() {
  const navigate = useNavigate();
  const { signIn, isDemoMode, setDemoRole, isPlatformOwner, isAuthenticated } = useAuth();
  const unlocked = isSuperAdminPatternUnlocked();
  const [email, setEmail] = useState(getPlatformOwnerLoginEmail());
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!unlocked) {
      toast.message("Platform access is locked", {
        description: "Use the logo tap pattern on the home or login screen first.",
      });
      void navigate({ to: "/", replace: true });
      return;
    }
    markSuperAdminDevice();
    setEmail(getPlatformOwnerLoginEmail());
  }, [navigate, unlocked]);

  useEffect(() => {
    if (isAuthenticated && isPlatformOwner) {
      void navigate({ to: "/admin", search: { section: "overview", company: undefined }, replace: true });
    }
  }, [isAuthenticated, isPlatformOwner, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlocked) return;
    setLoading(true);

    if (isDemoMode) {
      markSuperAdminDevice();
      setDemoRole("Super Admin");
      void navigate({ to: "/admin", search: { section: "overview", company: undefined } });
      setLoading(false);
      return;
    }

    const result = await signIn(email.trim().toLowerCase(), password);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    markSuperAdminDevice();
    void navigate({ to: "/admin", search: { section: "overview", company: undefined } });
    setLoading(false);
  };

  if (!unlocked) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-950 text-sm text-white/70">
        Returning…
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.35),_transparent_55%)]" />
      <FadeIn className="relative w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-600/20 bg-teal-600/10 px-3 py-1 text-xs font-medium text-teal-800">
            <Shield className="h-3.5 w-3.5" />
            {PLATFORM_OWNER} · Platform owner
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Platform console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pattern unlocked. Sign in with the owner account — works on any phone or computer.
          </p>

          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="platform-email">Owner email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="platform-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="platform-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!isDemoMode}
                  autoComplete="current-password"
                  placeholder={isDemoMode ? "Not required in demo" : "Your password"}
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-teal-700 text-white hover:bg-teal-600"
            >
              {loading ? "Signing in…" : "Open platform console"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-white/45">{PRODUCT_NAME} platform — not company staff login</p>
      </FadeIn>
    </div>
  );
}
