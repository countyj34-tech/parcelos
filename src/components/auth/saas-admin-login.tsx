import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Lock, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";
import { getSupabase } from "@/lib/supabase/client";
import { loadAuthProfile } from "@/lib/auth/load-profile";

type Step = 1 | 2;

const emptyGate1 = { email: "", password: "" };
const emptyGate2 = { phone: "", name: "", email: "", password: "" };

export function SaasAdminLogin() {
  const { completeSuperAdminLogin } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);

  const [gate1, setGate1] = useState(emptyGate1);
  const [gate2, setGate2] = useState(emptyGate2);

  const onStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      toast.error("Supabase not configured");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: gate1.email.trim(),
        password: gate1.password,
      });
      if (error) {
        toast.error("Invalid organisation credentials");
        return;
      }

      await supabase.auth.signOut();
      setStep(2);
      toast.success("First sign-in verified");
    } finally {
      setBusy(false);
    }
  };

  const onStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      toast.error("Supabase not configured");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: gate2.email.trim(),
        password: gate2.password,
      });
      if (error) {
        toast.error("Owner sign-in failed", { description: error.message });
        return;
      }

      await supabase.auth.updateUser({
        data: {
          full_name: gate2.name.trim(),
          phone: gate2.phone.trim(),
        },
      });

      const loaded = await loadAuthProfile(data.session);
      if (!loaded?.isPlatformOwner) {
        await supabase.auth.signOut();
        toast.error("Not a platform owner account", {
          description: "Run bootstrap_platform_admin for mthunzilabs@gmail.com in Supabase SQL.",
        });
        return;
      }

      await completeSuperAdminLogin();
      toast.success("Signed in", {
        description: "Supabase saved your session — you stay logged in on this device.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700/10">
            <Shield className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {PRODUCT_NAME} · {PLATFORM_OWNER}
            </p>
            <h1 className="font-display text-xl font-bold">
              {step === 1 ? "Owner sign-in (1 of 2)" : "Owner sign-in (2 of 2)"}
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {step === 1
            ? "Logo pattern verified. Sign in with the organisation Supabase account."
            : "Sign in with your owner Supabase account. Session is saved automatically."}
        </p>

        {step === 1 ? (
          <form className="mt-6 space-y-4" onSubmit={onStep1} autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="gate1-email">Email</Label>
              <Input
                id="gate1-email"
                name="saas-gate1-email"
                type="email"
                autoComplete="off"
                value={gate1.email}
                onChange={(e) => setGate1((v) => ({ ...v, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate1-password">Password</Label>
              <Input
                id="gate1-password"
                name="saas-gate1-password"
                type="password"
                autoComplete="new-password"
                value={gate1.password}
                onChange={(e) => setGate1((v) => ({ ...v, password: e.target.value }))}
                required
              />
            </div>
            <Button type="submit" className="w-full rounded-xl bg-teal-700 hover:bg-teal-600" disabled={busy}>
              <Lock className="mr-2 h-4 w-4" />
              {busy ? "Checking…" : "Continue"}
            </Button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onStep2} autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="gate2-phone">Phone number</Label>
              <Input
                id="gate2-phone"
                name="saas-gate2-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={gate2.phone}
                onChange={(e) => setGate2((v) => ({ ...v, phone: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate2-name">Full name</Label>
              <Input
                id="gate2-name"
                name="saas-gate2-name"
                type="text"
                autoComplete="off"
                value={gate2.name}
                onChange={(e) => setGate2((v) => ({ ...v, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate2-email">Email</Label>
              <Input
                id="gate2-email"
                name="saas-gate2-email"
                type="email"
                autoComplete="off"
                value={gate2.email}
                onChange={(e) => setGate2((v) => ({ ...v, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate2-password">Password</Label>
              <Input
                id="gate2-password"
                name="saas-gate2-password"
                type="password"
                autoComplete="new-password"
                value={gate2.password}
                onChange={(e) => setGate2((v) => ({ ...v, password: e.target.value }))}
                required
              />
            </div>
            <Button type="submit" className="w-full rounded-xl bg-teal-700 hover:bg-teal-600" disabled={busy}>
              <User className="mr-2 h-4 w-4" />
              {busy ? "Signing in…" : "Unlock console"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-xl"
              disabled={busy}
              onClick={() => {
                setStep(1);
                setGate2(emptyGate2);
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to step 1
            </Button>
          </form>
        )}

        <Button asChild variant="outline" className="mt-4 w-full rounded-xl">
          <Link to="/">Leave console</Link>
        </Button>
      </div>
    </div>
  );
}
