import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { fetchCompanyBilling } from "@/lib/api/billing";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Soft nudge while company is still on the 14-day free trial. */
export function TrialBanner() {
  const { role, isPlatformOwner, isDemoMode } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || isPlatformOwner || isDemoMode) return;
    let cancelled = false;
    void fetchCompanyBilling().then((b) => {
      if (cancelled || !b) return;
      const trial =
        (b.companyStatus === "trial" || b.subscriptionStatus === "trialing") && !b.locked;
      if (trial && b.daysLeft != null) {
        setDaysLeft(b.daysLeft);
        setShow(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isPlatformOwner, isDemoMode]);

  if (!show || daysLeft == null) return null;

  const canPay = role === "Company Admin" || role === "Branch Manager" || role === "Finance";
  const urgent = daysLeft <= 3;

  return (
    <div
      className={
        urgent
          ? "border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-amber-950 dark:text-amber-100"
          : "border-b border-teal-600/20 bg-teal-600/10 px-4 py-2.5 text-teal-950 dark:text-teal-50"
      }
    >
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4 shrink-0" />
          {daysLeft === 0
            ? "Trial ends today"
            : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left on your free trial`}
          <span className="font-normal opacity-80">— then monthly billing keeps the workspace live.</span>
        </p>
        {canPay ? (
          <Button asChild size="sm" className="h-8 rounded-lg" variant={urgent ? "default" : "outline"}>
            <Link to="/app/subscription">Subscribe</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
