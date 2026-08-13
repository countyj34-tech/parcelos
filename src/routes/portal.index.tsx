import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Package, Search, UserRound } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { useTenant } from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "Customer portal" },
      {
        name: "description",
        content: "Official courier website — anyone can send and track parcels with this company.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PortalHome,
});

const ACTIONS = [
  {
    label: "Send Parcel",
    desc: "Register before you visit",
    to: "/portal/register",
    icon: Package,
  },
  {
    label: "Track Parcel",
    desc: "Follow your shipment live",
    to: "/portal/track",
    icon: Search,
  },
  {
    label: "Sign In",
    desc: "History & saved receivers",
    to: "/portal/sign-in",
    icon: UserRound,
  },
] as const;

function PortalHome() {
  const { tenant } = useTenant();

  useEffect(() => {
    document.title = `${tenant.name} — Customer portal`;
  }, [tenant.name]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <FadeIn className="flex w-full max-w-4xl flex-col gap-4 sm:gap-5 md:items-center md:gap-6 md:text-center">
        <div className="md:max-w-2xl">
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="mb-4 h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/25 md:mx-auto md:h-20 md:w-20"
            />
          ) : (
            <span
              className="mb-4 grid h-16 w-16 place-items-center rounded-2xl text-xl font-bold shadow-lg ring-2 ring-white/25 md:mx-auto md:h-20 md:w-20 md:text-2xl"
              style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
            >
              {tenant.logoInitials}
            </span>
          )}
          <h1 className="font-display text-[1.85rem] font-bold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl lg:text-5xl">
            {tenant.name}
          </h1>
          <p className="mt-2 text-sm text-white/80 sm:text-base">
            {tenant.tagline?.trim()
              ? tenant.tagline
              : "Send and track parcels with this courier — official customer portal."}
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-4">
          {ACTIONS.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/20 bg-white/95",
                "px-4 py-3.5 text-left shadow-lg backdrop-blur-sm",
                "transition-all duration-200 ease-out",
                "hover:-translate-y-1 hover:ring-2 hover:ring-[var(--tenant-primary)]/40",
                "hover:bg-white hover:shadow-xl",
                "active:translate-y-0 active:scale-[0.99]",
                "md:min-h-[168px] md:flex-col md:items-start md:justify-between md:p-5 lg:p-6",
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100"
                style={{ background: "var(--tenant-primary)" }}
              />
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105 md:h-12 md:w-12"
                style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
              >
                <action.icon className="h-4 w-4 md:h-5 md:w-5" />
              </span>
              <span className="min-w-0 flex-1 md:mt-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="block text-[15px] font-semibold text-foreground md:text-lg">
                    {action.label}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-1 group-hover:text-[var(--tenant-primary)] md:hidden" />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground md:mt-1.5 md:text-sm">
                  {action.desc}
                </span>
              </span>
              <ArrowRight className="mt-auto hidden h-4 w-4 text-muted-foreground transition-all duration-200 group-hover:translate-x-1 group-hover:text-[var(--tenant-primary)] md:block" />
            </Link>
          ))}
        </div>

        <p className="text-xs text-white/65 sm:text-sm">
          Need help? Call {tenant.name}:{" "}
          <a
            href={`tel:${tenant.supportPhone.replace(/\s/g, "")}`}
            className="font-semibold text-white underline-offset-2 transition-colors hover:underline"
            style={{ textDecorationColor: "var(--tenant-primary)" }}
          >
            {tenant.supportPhone || "support"}
          </a>
        </p>
      </FadeIn>
    </div>
  );
}
