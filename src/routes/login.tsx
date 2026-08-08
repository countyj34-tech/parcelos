import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Lock, Mail, MapPin, Shield } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { CompanyBrand, CompanyMeta } from "@/components/site/company-brand";
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
import { DEMO_TENANT } from "@/lib/tenant";
import { DEMO_ROLES, ROLE_USERS, getHomeRouteForRole, type UserRole } from "@/lib/roles";
import { toast } from "sonner";

const HERO_IMAGE = "/images/hero-courier-ops.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: CompanyMeta("Sign in") },
      { name: "description", content: `Sign in to the ${DEMO_TENANT.name} operations workspace.` },
    ],
  }),
  component: LoginPage,
});

/** Staff roles only — owners sign in here, not platform SaaS marketing. */
const LOGIN_ROLES: UserRole[] = [...DEMO_ROLES, "Super Admin"];

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  "Super Admin": "System Administrator",
};

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, resetPassword, isDemoMode, setDemoRole } = useAuth();
  const [role, setRole] = useState<UserRole>("Company Admin");
  const [email, setEmail] = useState(ROLE_USERS[role].email);
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
      toast.message("Contact IT to reset your password");
      return;
    }
    const result = await resetPassword(email);
    if (result.error) toast.error(result.error);
    else toast.success("Password reset email sent");
  };

  return (
    <div className="relative min-h-screen">
      {/* Full-page background */}
      <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/65 to-primary/40" />

      <div className="relative grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
        {/* Form panel */}
        <FadeIn className="flex items-center justify-center px-5 py-12 lg:px-12">
          <div className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-background/95 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
            <CompanyBrand showTagline />
            <h1 className="mt-8 text-[28px] font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your {DEMO_TENANT.name} workspace
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              {isDemoMode ? (
                <div className="space-y-2">
                  <Label htmlFor="role">Sign in as</Label>
                  <Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                    <SelectTrigger id="role" className="h-12 rounded-xl">
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
                    className="h-12 rounded-xl pl-11 text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => void handleForgotPassword()}
                    className="text-sm font-medium text-primary hover:underline"
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
                    placeholder={isDemoMode ? "Not required in demo" : ""}
                    autoComplete="current-password"
                    className="h-12 rounded-xl pl-11 text-base"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-base">
                {loading ? "Signing in…" : "Sign in to workspace"}{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Customer?{" "}
              <Link to="/portal" className="font-medium text-primary hover:underline">
                Go to customer portal
              </Link>
            </p>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              New courier company?{" "}
              <Link to="/join" className="font-medium text-primary hover:underline">
                Launch your portal
              </Link>
            </p>
          </div>
        </FadeIn>

        {/* Owner-facing visual panel */}
        <div className="relative hidden flex-col justify-end p-12 lg:flex">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur">
              <Shield className="h-4 w-4" />
              Secure staff access only
            </div>
            <h2 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-white">
              Run {DEMO_TENANT.name} with confidence.
            </h2>
            <p className="mt-4 text-lg text-white/75">
              Reception, dispatch, finance and every branch — one system built for your team.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-3">
              {[
                ["412", "Parcels today"],
                ["12", "Branches live"],
                ["96.4%", "On-time"],
                ["84", "Team members"],
              ].map(([v, l]) => (
                <div
                  key={l}
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-4 backdrop-blur-md"
                >
                  <p className="font-display text-2xl font-bold text-white">{v}</p>
                  <p className="mt-0.5 text-xs text-white/65">{l}</p>
                </div>
              ))}
            </div>

            <p className="mt-10 flex items-center gap-2 text-xs text-white/50">
              <MapPin className="h-3.5 w-3.5" />
              {DEMO_TENANT.domain}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
