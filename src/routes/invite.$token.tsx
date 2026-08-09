import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase/client";
import { PRODUCT_NAME } from "@/lib/brand";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: `Accept invite — ${PRODUCT_NAME}` }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<{
    email: string;
    full_name: string;
    company_name: string;
    role_code: string;
    expired: boolean;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.rpc("lookup_staff_invite", { p_token: token }).then(({ data, error }) => {
      setLoading(false);
      if (error || !data) {
        toast.error(error?.message ?? "Invite not found");
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      setInfo(row as typeof info);
    });
  }, [token]);

  const onAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;

    setSubmitting(true);
    const { error } = await supabase.rpc("accept_staff_invite", {
      p_token: token,
      p_password: password,
    });
    if (error) {
      toast.error(error.message, {
        description: error.message.includes("already")
          ? "Try signing in with this email, or ask for a fresh invite."
          : undefined,
      });
      setSubmitting(false);
      return;
    }

    if (info?.email) {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: info.email,
        password,
      });
      if (signErr) {
        toast.success("Account ready — please sign in", {
          description: "If email confirmation is on, confirm first then use your new password.",
        });
        void navigate({ to: "/login" });
        setSubmitting(false);
        return;
      }
    }

    toast.success("Welcome to the team");
    void navigate({ to: "/app" });
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-teal-50 to-background dark:from-teal-950/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-teal-50 via-background to-background dark:from-teal-950/40">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <p className="text-sm font-semibold text-teal-700">{PRODUCT_NAME}</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Join your team</h1>
        {info ? (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">{info.company_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {info.full_name} · {info.role_code.replace(/_/g, " ")}
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-teal-700" />
              <span>{info.email}</span>
            </p>
            <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              Use this exact email — your workspace login is tied to the invite.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">This invite link is invalid or was revoked.</p>
        )}

        {info && !info.expired ? (
          <form className="mt-8 space-y-4" onSubmit={(e) => void onAccept(e)}>
            <div className="space-y-1.5">
              <Label>Create password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  className="h-12 rounded-xl pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input
                type="password"
                className="h-12 rounded-xl"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl bg-teal-700 hover:bg-teal-600">
              {submitting ? "Joining…" : "Join workspace"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        ) : info?.expired ? (
          <div className="mt-6 space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <p>This invite has expired or was already used.</p>
            <p className="text-muted-foreground">Ask your admin to send a new invite from Staff.</p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/login">Go to sign in</Link>
            </Button>
          </div>
        ) : null}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have access?{" "}
          <Link to="/login" className="font-semibold text-teal-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
