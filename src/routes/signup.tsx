import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Clock, Lock, Mail, Phone, UserRound } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { SecretLogoTap } from "@/components/secret-logo-tap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { signUpCourierCompany } from "@/lib/api/signup";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const HERO_IMAGE = "/images/hero-courier-ops.jpg";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: `Create account — ${PRODUCT_NAME}` },
      {
        name: "description",
        content: "Create your courier company account and start receiving parcels under your brand.",
      },
    ],
  }),
  component: SignupPage,
});

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
        <p className="font-display text-sm font-semibold tabular-nums tracking-wide sm:text-base">{time}</p>
        <p className="text-[10px] text-white/65 sm:text-xs">{date}</p>
      </div>
    </div>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const { isDemoMode, refreshProfileAfterAuth } = useAuth();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isDemoMode) {
      toast.error("Connect Supabase to create real accounts", {
        description: "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.",
      });
      return;
    }

    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const result = await signUpCourierCompany({
        fullName,
        companyName,
        email,
        phone,
        password,
      });

      if (result.needsEmailConfirmation) {
        toast.success("Account created — sign in to continue");
        void navigate({ to: "/login" });
        return;
      }

      await refreshProfileAfterAuth();
      toast.success(
        result.welcomeEmailSent
          ? "Welcome! Check your inbox for a congratulations email"
          : "Account created — set up your brand next",
      );
      void navigate({ to: "/app/onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh">
      <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/70 to-teal-900/45" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-6 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <SecretLogoTap className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-600 text-sm font-bold text-white shadow-lg">
              P
            </span>
            <div>
              <p className="font-display text-lg font-bold text-white">{PRODUCT_NAME}</p>
              <p className="text-[11px] text-white/55">{PLATFORM_OWNER}</p>
            </div>
          </SecretLogoTap>
          <LiveClock />
        </div>

        <FadeIn className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-8 md:max-w-2xl lg:max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-background/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8 md:p-10 lg:min-h-[min(70vh,40rem)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">New company</p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Register your courier company, then add receptionists and share your customer portal link.
            </p>

            <form className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5" onSubmit={(e) => void handleSubmit(e)}>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company">Company name *</Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    placeholder="e.g. Swift Logistics"
                    className="h-12 rounded-xl pl-11 text-base md:h-14"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Your full name *</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                    className="h-12 rounded-xl pl-11 text-base md:h-14"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+260 …"
                    className="h-12 rounded-xl pl-11 text-base md:h-14"
                  />
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Work email *</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-12 rounded-xl pl-11 text-base md:h-14"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="h-12 rounded-xl pl-11 text-base md:h-14"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password *</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-12 rounded-xl pl-11 text-base md:h-14"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 pt-1">
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-teal-700 text-base text-white hover:bg-teal-600 md:h-14"
                >
                  {loading ? "Creating account…" : "Create account"}{" "}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-teal-700 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
