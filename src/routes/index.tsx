import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Building2, Package, Shield, Truck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FadeIn, FadeInStagger, StaggerItem } from "@/components/motion/fade-in";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { CompanyMeta } from "@/components/site/company-brand";
import { Button } from "@/components/ui/button";
import { DEMO_TENANT } from "@/lib/tenant";

const HERO_IMAGE = "/images/hero-courier-ops.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: CompanyMeta("Operations") },
      {
        name: "description",
        content:
          "Run reception, dispatch, branches and customer service from your secure courier operations workspace.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Package,
    title: "Reception & Intake",
    body: "Register parcels in seconds. Verify, collect payment and print labels without the queue.",
  },
  {
    icon: Truck,
    title: "Dispatch & Tracking",
    body: "Move parcels across branches with live status updates your team and customers can trust.",
  },
  {
    icon: Building2,
    title: "All Branches, One View",
    body: "Monitor every location — Cairo Road, Ndola, Kitwe and beyond — from a single dashboard.",
  },
  {
    icon: BarChart3,
    title: "Finance & Reports",
    body: "Revenue, volumes and branch performance updated in real time for confident decisions.",
  },
];

const INSIGHTS = [
  { label: "Parcels today", value: "412" },
  { label: "Active branches", value: "12" },
  { label: "On-time delivery", value: "96.4%" },
  { label: "Team members", value: "84" },
];

const FAQS = [
  {
    q: "Who can access the system?",
    a: "Only your authorised staff — reception, dispatch, finance, branch managers and drivers. Each role sees exactly what they need.",
  },
  {
    q: "Can customers register parcels before arriving?",
    a: "Yes. Customers register online, receive a reference number, then walk in for quick verify-and-pay at reception.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. Your customer portal installs like an app on any phone. Staff can use the workspace on tablet or desktop.",
  },
  {
    q: "Is our data secure?",
    a: "Your parcel records, customer data and financial reports are encrypted and accessible only within your organisation.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader transparent />

      {/* Hero — full-bleed operations imagery */}
      <section className="relative min-h-[92vh] overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />

        <FadeIn className="relative mx-auto flex min-h-[92vh] max-w-4xl flex-col items-center justify-center px-5 pb-20 pt-28 text-center lg:px-8">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
            {DEMO_TENANT.name} · Operations Workspace
          </span>
          <h1 className="mt-8 font-display text-[40px] font-extrabold leading-[1.06] tracking-tight text-white sm:text-[56px]">
            Your courier network.
            <br />
            One powerful system.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
            Reception, dispatch, branches, payments and customer service — built for how{" "}
            <span className="font-medium text-white">{DEMO_TENANT.name}</span> runs every day.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-14 rounded-full px-8 text-base shadow-xl">
              <Link to="/login">
                Sign in to workspace <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-full border-white/30 bg-white/10 px-8 text-base text-white backdrop-blur hover:bg-white/20 hover:text-white"
            >
              <Link to="/track">Track a parcel</Link>
            </Button>
          </div>

          <div className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {INSIGHTS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-md"
              >
                <p className="font-display text-2xl font-bold text-white sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs text-white/65">{s.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* Operations */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <FadeIn className="mb-12 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Built for your operations</h2>
          <p className="mt-3 text-muted-foreground">
            Everything your team needs — nothing they don&apos;t.
          </p>
        </FadeIn>
        <FadeInStagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <div className="card-elevated h-full p-6 transition-transform duration-200 hover:-translate-y-1">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </StaggerItem>
          ))}
        </FadeInStagger>
      </section>

      {/* Insights strip */}
      <section id="insights" className="relative overflow-hidden border-y border-border">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-primary/90 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
        <FadeIn className="relative mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                <Shield className="h-3.5 w-3.5" />
                Secure · Private · Yours
              </div>
              <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
                Command centre for owners and managers
              </h2>
              <p className="mt-4 text-white/80 leading-relaxed">
                See parcels moving, branches performing and revenue flowing — without spreadsheets,
                phone calls or guesswork.
              </p>
              <Button asChild size="lg" className="mt-8 rounded-full bg-white text-primary hover:bg-white/90">
                <Link to="/login">Open your dashboard</Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              {INSIGHTS.map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                  <p className="font-display text-3xl font-bold text-white">{s.value}</p>
                  <p className="mt-1 text-sm text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-2xl px-5 py-20 lg:px-8">
        <FadeIn>
          <h2 className="text-center text-3xl font-bold">Questions</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            About your {DEMO_TENANT.name} workspace
          </p>
          <Accordion type="single" collapsible className="mt-8">
            {FAQS.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="border-border">
                <AccordionTrigger className="text-left text-base font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </FadeIn>
      </section>

      <SiteFooter />
    </div>
  );
}
