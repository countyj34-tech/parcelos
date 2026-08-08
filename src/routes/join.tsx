import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATFORM_OWNER } from "@/lib/brand";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join — Courier companies" },
      {
        name: "description",
        content: "Create your courier brand, share your portal link and QR with customers.",
      },
    ],
  }),
  component: CompanyJoinPage,
});

function CompanyJoinPage() {
  return (
    <div className="min-h-svh bg-gradient-to-b from-slate-950 via-slate-900 to-teal-950 text-white">
      <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-5 py-12 sm:max-w-xl sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-teal-300/90">{PLATFORM_OWNER}</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Launch your courier portal
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
          Create your company brand, then share one link and QR code. Customers who open it only see your business —
          send parcels, track, and view your rates.
        </p>

        <ul className="mt-8 space-y-4 text-sm text-white/80">
          <li className="flex gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
            <span>Sign in to your workspace and set logo, colours, and price chart.</span>
          </li>
          <li className="flex gap-3">
            <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
            <span>Copy your customer link or share it on WhatsApp and social media.</span>
          </li>
          <li className="flex gap-3">
            <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
            <span>Print the QR for your counter — scan opens your branded portal.</span>
          </li>
        </ul>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 rounded-xl bg-teal-600 text-white hover:bg-teal-500">
            <Link to="/login">
              Open company workspace <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-xl border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          >
            <Link to="/c/$slug" params={{ slug: "swift-logistics" }}>
              Preview customer portal
            </Link>
          </Button>
        </div>

        <p className="mt-8 text-xs text-white/45">
          Share this page with other courier companies via WhatsApp. Customers should use your company link from Settings
          → Launch &amp; share — not this page.
        </p>
      </div>
    </div>
  );
}
