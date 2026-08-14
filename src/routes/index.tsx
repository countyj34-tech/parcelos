import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Building2, Palette, Share2, Users } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { SecretLogoTap } from "@/components/secret-logo-tap";
import { Button } from "@/components/ui/button";
import { PLATFORM_OWNER, PRODUCT_NAME } from "@/lib/brand";
import { clearCustomerPortalMode } from "@/lib/portal-mode";
import { useAuth } from "@/hooks/use-auth";
import { getHomeRouteForRole } from "@/lib/roles";
import { useEffect } from "react";

const HERO_IMAGE = "/images/hero-courier-ops.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${PRODUCT_NAME} — Create your courier brand` },
      {
        name: "description",
        content:
          "Set up your company brand, invite receptionists, and share your customer portal link or QR.",
      },
    ],
  }),
  component: CompanyHome,
});

/**
 * Company app home (PWA install + first open).
 * Customers never land here — they use /c/{slug} shared by the company.
 * Logged-in staff are sent back to their role workspace.
 */
function CompanyHome() {
  const navigate = useNavigate();
  const { isAuthenticated, isDemoMode, isSaasSuperAdmin, isCustomer, role, isLoading } = useAuth();

  useEffect(() => {
    clearCustomerPortalMode();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (isSaasSuperAdmin) {
      void navigate({ to: "/admin", search: { section: "overview", company: undefined }, replace: true });
      return;
    }
    if (isCustomer) {
      void navigate({ to: "/portal", replace: true });
      return;
    }
    // Demo mode is always "authenticated" — only bounce real sessions into the desk
    if (isAuthenticated && !isDemoMode) {
      void navigate({ to: getHomeRouteForRole(role), replace: true });
    }
  }, [isAuthenticated, isCustomer, isDemoMode, isLoading, isSaasSuperAdmin, navigate, role]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <img
        src={HERO_IMAGE}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_28%]"
        fetchPriority="high"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 35%, rgba(15,118,110,0.35) 70%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <SecretLogoTap className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-600 text-sm font-bold text-white shadow-lg">
            P
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">{PRODUCT_NAME}</span>
        </SecretLogoTap>
        <p className="hidden text-xs text-white/60 sm:block">{PLATFORM_OWNER}</p>
      </header>

      <FadeIn className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-10 sm:max-w-xl sm:px-8">
        <p className="text-sm font-medium text-white/75">For courier companies</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Create your brand to get started
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
          This app is for your company — not your customers. Set up your logo and colours, add receptionists, then share
          your portal link or QR so customers send and track parcels under your name.
        </p>

        <ul className="mt-8 space-y-3 text-sm text-white/85">
          <li className="flex gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <Palette className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
            <span>
              <strong className="text-white">Create brand</strong>
              <span className="mt-0.5 block text-white/65">Logo, colours, and company name</span>
            </span>
          </li>
          <li className="flex gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
            <span>
              <strong className="text-white">Add your team</strong>
              <span className="mt-0.5 block text-white/65">Receptionists, branch staff, and admins</span>
            </span>
          </li>
          <li className="flex gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
            <span>
              <strong className="text-white">Share link or QR</strong>
              <span className="mt-0.5 block text-white/65">Customers open your branded portal only</span>
            </span>
          </li>
        </ul>

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg" className="h-14 rounded-2xl bg-teal-600 text-base font-semibold text-white hover:bg-teal-500">
            <Link to="/signup">
              Create account <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-14 rounded-2xl border-white/25 bg-white/10 text-base text-white hover:bg-white/15 hover:text-white"
          >
            <Link to="/login">
              <Building2 className="mr-2 h-4 w-4" /> Company admin login
            </Link>
          </Button>
        </div>

        <p className="mt-8 text-center text-xs text-white/50">
          Customers should not use this screen. Give them your share link or QR from the company workspace.
        </p>
      </FadeIn>
    </div>
  );
}
