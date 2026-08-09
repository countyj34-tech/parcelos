import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Clock, Lock, Mail, MapPin, Shield } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { SecretLogoTap } from "@/components/secret-logo-tap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";
import { DEMO_ROLES, ROLE_USERS, getHomeRouteForRole, type UserRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const HERO_IMAGE = "/images/hero-courier-ops.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Sign in — ${PRODUCT_NAME}` },
      { name: "description", content: `Sign in to your ${PRODUCT_NAME} courier workspace.` },
    ],
  }),
  component: LoginPage,
});

/** Staff roles only — owners sign in here, not platform SaaS marketing. */
const LOGIN_ROLES: UserRole[] = [...DEMO_ROLES, "Super Admin"];

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  "Super Admin": "System Administrator",
};

function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const date = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/25 px-3 py-1.5 text-white backdrop-blur-md",
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-white/70" />
      <div className="leading-tight">
        <p className="font-display text-base font-semibold tabular-nums tracking-wide sm:text-lg">{time}</p>
        <p className="text-[10px] text-white/65 sm:text-xs">{date}</p>
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, resetPassword, isDemoMode, setDemoRole } = useAuth();
  const [role, setRole] = useState<UserRole>("Company Admin");
  const [email, setEmail] = useState(isDemoMode ? ROLE_USERS[role].email : "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRoleChange = (next: UserRole) => {
    setRole(next);
    setEmail(ROLE_USERS[next].email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isDemoMode) {
      setDemoRole(role);
      void navigate({ to: getHomeRouteForRole(role) });
      setLoading(false);
      return;
    }

    const result = await signIn(email, password);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    void navigate({ to: result.redirect });
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (isDemoMode) {
      toast.message("Contact your company admin to reset your password");
      return;
    }
    if (!email.trim()) {
      toast.error("Enter your work email first");
      return;
    }
    const result = await resetPassword(email);
    if (result.error) toast.error(result.error);
    else toast.success("Password reset email sent");
  };

  return (
    <div className="relative min-h-dvh">
      <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/70 to-teal-900/40" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-5 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <SecretLogoTap className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-600 text-sm font-bold text-white shadow-lg">
              P
            </span>
            <div>
              <p className="font-display text-lg font-bold text-white">{PRODUCT_NAME}</p>
              <p className="hidden text-[11px] text-white/55 sm:block">{PLATFORM_OWNER}</p>
            </div>
          </SecretLogoTap>
          <LiveClock />
        </div>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 lg:py-6">
          <FadeIn className="flex w-full justify-center lg:justify-start">
            <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-background/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8 md:max-w-2xl md:p-10 lg:min-h-[min(68vh,38rem)]">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Sign in to your courier company workspace
              </p>

              <form className="mt-7 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
                {isDemoMode ? (
                  <div className="space-y-2">
                    <Label htmlFor="role">Sign in as</Label>
                    <Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                      <SelectTrigger id="role" className="h-12 rounded-xl md:h-14">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOGIN_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r] ?? r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="you@yourcourier.com"
                      className="h-12 rounded-xl pl-11 text-base md:h-14"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => void handleForgotPassword()}
                      className="text-sm font-medium text-teal-700 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!isDemoMode}
                      placeholder={isDemoMode ? "Not required in demo" : "Your password"}
                      autoComplete="current-password"
                      className="h-12 rounded-xl pl-11 text-base md:h-14"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-teal-700 text-base text-white hover:bg-teal-600 md:h-14"
                >
                  {loading ? "Signing in…" : "Sign in to workspace"}{" "}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className="mt-8 space-y-4 border-t border-border pt-6 text-center">
                <p className="text-sm text-muted-foreground">Don&apos;t have an account yet?</p>
                <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base md:h-14">
                  <Link to="/signup">Create account</Link>
                </Button>
              </div>
            </div>
          </FadeIn>

          <div className="hidden flex-col justify-center lg:flex">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur">
                <Shield className="h-4 w-4" />
                Secure staff access
              </div>
              <h2 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
                Your brand. Your counter. Your customers.
              </h2>
              <p className="mt-4 text-lg text-white/75">
                Reception, dispatch, finance and every branch — one workspace for your courier team.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-white/85">
                <li className="rounded-2xl border border-white/15 bg-black/25 px-4 py-3 backdrop-blur-md">
                  Register walk-ins and print receipts at the desk
                </li>
                <li className="rounded-2xl border border-white/15 bg-black/25 px-4 py-3 backdrop-blur-md">
                  Share a branded portal link or QR with customers
                </li>
                <li className="rounded-2xl border border-white/15 bg-black/25 px-4 py-3 backdrop-blur-md">
                  Track parcels and payments in one place
                </li>
              </ul>
              <p className="mt-10 flex items-center gap-2 text-xs text-white/50">
                <MapPin className="h-3.5 w-3.5" />
                {PRODUCT_NAME} · {PLATFORM_OWNER}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
