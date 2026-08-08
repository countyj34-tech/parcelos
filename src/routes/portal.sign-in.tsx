import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Lock, Phone } from "lucide-react";
import { useState } from "react";
import { FadeIn } from "@/components/motion/fade-in";
import { TenantMark } from "@/components/portal/tenant-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/sign-in")({
  head: () => ({ meta: [{ title: "Sign in" }] }),
  component: PortalSignIn,
});

function PortalSignIn() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { signIn, isDemoMode } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isDemoMode) {
      void navigate({ to: "/portal/history" });
      setLoading(false);
      return;
    }

    const email = identifier.includes("@") ? identifier : `${identifier}@customer.local`;
    const result = await signIn(email, password);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    void navigate({ to: result.redirect.includes("portal") ? "/portal/history" : result.redirect });
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <img
        src={tenant.heroImageUrl}
        alt=""
        className="absolute left-0 top-0 h-[145%] w-full object-cover object-[50%_32%] max-md:-translate-y-[18%] md:inset-0 md:h-full md:translate-y-0 md:object-[center_28%]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.18) 16%, rgba(0,0,0,0.35) 42%, color-mix(in srgb, var(--tenant-primary) 22%, transparent) 62%, rgba(0,0,0,0.88) 100%)",
        }}
      />

      <header className="relative z-20 shrink-0 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div
          className="mx-auto flex max-w-lg items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3"
          style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
        >
          <Link to="/portal" className="flex items-center gap-2.5">
            <TenantMark />
            <span className="font-display text-sm font-bold text-white sm:text-base">{tenant.name}</span>
          </Link>
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white sm:text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </header>

      <main
        className="relative z-10 mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <FadeIn className="w-full">
          <div className="rounded-2xl border border-white/20 bg-white/95 p-5 shadow-xl backdrop-blur-md sm:p-7">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Access your {tenant.name} account
            </p>

            <form className="mt-5 space-y-4 sm:mt-6 sm:space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Phone or email</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required={!isDemoMode}
                    placeholder="+260 977 000 000"
                    className="h-11 rounded-xl bg-background pl-10 text-base sm:h-12 sm:pl-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs font-medium hover:underline"
                    style={{ color: "var(--tenant-primary)" }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!isDemoMode}
                    placeholder="Your password"
                    className="h-11 rounded-xl bg-background pl-10 text-base sm:h-12 sm:pl-11"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl text-base sm:h-12"
                style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
              >
                {loading ? "Signing in…" : "Sign in"} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link
                to="/portal/register"
                className="font-semibold hover:underline"
                style={{ color: "var(--tenant-primary)" }}
              >
                Send a parcel as guest
              </Link>
            </p>
          </div>
        </FadeIn>
      </main>
    </div>
  );
}
