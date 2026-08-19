import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Copy,
  MessageCircle,
  Package,
  PartyPopper,
  QrCode,
  Sparkles,
  UserRound,
  Table2,
} from "lucide-react";
import { FadeIn, ScaleIn } from "@/components/motion/fade-in";
import { TenantHeader } from "@/components/portal/tenant-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/status-pill";
import { useTenant } from "@/hooks/use-tenant";
import { createGuestParcel, fallbackParcelCategories, listCompanyBranches, listCompanyCategories, resolveParcelCategory } from "@/lib/api/parcels";
import { registerCustomerAccount } from "@/lib/api/customer-auth";
import {
  DESTINATION_PROVINCES,
  OTHER_PROVINCE_VALUE,
  branchesForProvince,
  matchBranchForProvince,
} from "@/lib/provinces";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  clearReceptionRegisterMode,
  isReceptionRegisterMode,
  markCustomerPortalMode,
  markReceptionRegisterMode,
} from "@/lib/portal-mode";
import { isCustomerPortalMode } from "@/lib/portal-mode";
import { resolveCompanyPublic } from "@/lib/api/tenant";
import { isCompanyUuid } from "@/lib/api/company-brand";
import { useAuth } from "@/hooks/use-auth";
import { getPublicTrackingUrl, getTrackingWhatsAppUrl } from "@/lib/tracking-url";

export const Route = createFileRoute("/portal/register")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: search.from === "reception" ? ("reception" as const) : undefined,
  }),
  head: () => ({
    meta: [{ title: "Send a parcel" }, { name: "description", content: "Register your parcel online" }],
  }),
  component: RegisterParcel,
});

const STEPS = ["Sender", "Receiver", "Parcel", "Review"];

type Mode = "choose" | "wizard" | "success";
const OTHER_CATEGORY_VALUE = "__other__";

type CheckoutAs = "guest" | "account" | null;

type FormState = {
  senderName: string;
  senderPhone: string;
  senderNrc: string;
  senderEmail: string;
  receiverName: string;
  receiverPhone: string;
  destination: string;
  destinationOther: string;
  originBranchId: string;
  destBranchId: string;
  password: string;
  passwordConfirm: string;
  description: string;
  declaredValue: string;
  category: string;
  categoryOther: string;
  weight: string;
  quantity: string;
  instructions: string;
};

const empty: FormState = {
  senderName: "",
  senderPhone: "",
  senderNrc: "",
  senderEmail: "",
  receiverName: "",
  receiverPhone: "",
  destination: "",
  destinationOther: "",
  originBranchId: "",
  destBranchId: "",
  password: "",
  passwordConfirm: "",
  description: "",
  declaredValue: "",
  category: "",
  categoryOther: "",
  weight: "",
  quantity: "1",
  instructions: "",
};

const ACCOUNT_BENEFITS = [
  "Parcel history",
  "Saved receivers",
  "Faster checkout",
  "Notifications",
] as const;

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
        <p className="font-display text-base font-semibold tabular-nums tracking-wide sm:text-lg md:text-xl">{time}</p>
        <p className="text-[10px] text-white/65 sm:text-xs md:text-sm">{date}</p>
      </div>
    </div>
  );
}

function PortalPage({
  children,
  wide = false,
  desk = false,
  receptionDesk = false,
}: {
  children: ReactNode;
  wide?: boolean;
  /** Counter / large-screen layout — fills the viewport */
  desk?: boolean;
  /** Staff walk-in — brand link returns to reception, not customer portal */
  receptionDesk?: boolean;
}) {
  const { tenant } = useTenant();

  return (
    <div
      className={cn(
        "relative flex min-h-dvh flex-col overflow-hidden",
        desk && "md:h-dvh md:max-h-dvh",
      )}
    >
      <img
        src={tenant.heroImageUrl}
        alt=""
        className="absolute left-0 top-0 h-[145%] w-full object-cover object-[50%_32%] max-md:-translate-y-[18%] md:inset-0 md:h-full md:translate-y-0 md:object-[center_28%]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.18) 16%, rgba(0,0,0,0.35) 42%, color-mix(in srgb, var(--tenant-primary) 22%, transparent) 62%, rgba(0,0,0,0.88) 100%)",
        }}
      />

      <TenantHeader
        transparent
        wide
        compact
        homeTo={receptionDesk ? "/app/reception" : "/portal"}
      />

      <main
        className={cn(
          "relative z-10 mx-auto flex w-full flex-1 flex-col px-4 sm:px-6 lg:px-8",
          desk
            ? "max-w-none md:max-w-[min(100%,76rem)] xl:max-w-[min(100%,88rem)] md:min-h-0 md:py-2 lg:px-10 lg:py-3"
            : wide
              ? "max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl md:justify-center md:py-6"
              : "max-w-md sm:max-w-lg",
        )}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
    </div>
  );
}

function RegisterParcel() {
  const { tenant, updateTenant, activateTenant } = useTenant();
  const { refreshProfileAfterAuth } = useAuth();
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const fromReception = from === "reception" || isReceptionRegisterMode();
  const [mode, setMode] = useState<Mode>(fromReception ? "wizard" : "choose");
  const [checkoutAs, setCheckoutAs] = useState<CheckoutAs>(fromReception ? "guest" : null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string; city?: string | null }>>([]);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>(
    () => fallbackParcelCategories(),
  );
  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isOtherCategory = form.category === OTHER_CATEGORY_VALUE;
  const categoryLabel =
    isOtherCategory
      ? form.categoryOther.trim() || "Other"
      : (categoryOptions.find((c) => c.id === form.category)?.name ?? form.category);

  const liveCompany = isSupabaseConfigured() && isCompanyUuid(tenant.id);

  useEffect(() => {
    if (from === "reception") markReceptionRegisterMode();
  }, [from]);

  // After counter register — land back on reception desk automatically
  useEffect(() => {
    if (mode !== "success" || !fromReception) return;
    const t = window.setTimeout(() => {
      clearReceptionRegisterMode();
      void navigate({
        to: "/app/reception",
        search: trackingNumber ? { q: trackingNumber, desk: "dropoff" } : { desk: "dropoff" },
      });
    }, 900);
    return () => window.clearTimeout(t);
  }, [fromReception, mode, navigate, trackingNumber]);

  // Shared-link customers: make sure we have the real company UUID (not demo tenant)
  useEffect(() => {
    if (!isSupabaseConfigured() || liveCompany) return;
    if (!isCustomerPortalMode() && !tenant.slug) return;
    let cancelled = false;
    void (async () => {
      const remote = await resolveCompanyPublic(tenant.slug);
      if (cancelled || !remote || !isCompanyUuid(remote.id)) return;
      updateTenant(remote);
      await activateTenant(remote.slug);
    })();
    return () => {
      cancelled = true;
    };
  }, [activateTenant, liveCompany, tenant.slug, updateTenant]);

  const exitToReception = () => {
    clearReceptionRegisterMode();
    void navigate({
      to: "/app/reception",
      search: trackingNumber ? { q: trackingNumber, desk: "dropoff" } : { desk: "dropoff" },
    });
  };

  useEffect(() => {
    if (!liveCompany) {
      setBranchOptions([]);
      setCategoryOptions(fallbackParcelCategories());
      setBranchesError(
        isSupabaseConfigured()
          ? "Open this courier’s share link again so we can load their branches."
          : "Connect Supabase to register live parcels.",
      );
      return;
    }
    let cancelled = false;
    setBranchesError(null);
    void listCompanyBranches(tenant.id).then((rows) => {
      if (cancelled) return;
      if (rows.length) {
        setBranchOptions(rows.map((b) => ({ id: b.id, name: b.name, city: b.city })));
        setBranchesError(null);
        setForm((f) => ({
          ...f,
          originBranchId: f.originBranchId || rows[0]!.id,
        }));
      } else {
        setBranchOptions([]);
        setBranchesError("This courier has no active branches yet. Ask them to add a branch in settings.");
      }
    });
    void listCompanyCategories(tenant.id).then((rows) => {
      if (cancelled) return;
      setCategoryOptions(rows.length ? rows : fallbackParcelCategories());
    });
    return () => {
      cancelled = true;
    };
  }, [liveCompany, tenant.id]);

  const destinationLabel =
    form.destination === OTHER_PROVINCE_VALUE
      ? form.destinationOther.trim()
      : form.destination.trim();
  const destinationOk = Boolean(destinationLabel);
  const destBranchChoices = destinationLabel
    ? branchesForProvince(branchOptions, destinationLabel)
    : branchOptions;
  const destinationOfficeOk = Boolean(form.destBranchId || destBranchChoices.length === 1);

  const senderOk = Boolean(form.senderName.trim() && form.senderPhone.trim());
  const accountOk =
    checkoutAs !== "account" ||
    (form.password.length >= 6 && form.password === form.passwordConfirm);
  const receiverOk = Boolean(
    form.receiverName.trim() && form.receiverPhone.trim() && destinationOk && destinationOfficeOk,
  );
  const parcelOk = Boolean(form.description.trim());

  const canContinue = () => {
    if (step === 0) return senderOk && accountOk;
    if (step === 1) return receiverOk;
    if (step === 2) return parcelOk;
    return receiverOk && senderOk && accountOk;
  };

  const goNext = () => {
    if (!canContinue()) {
      setAttempted(true);
      if (step === 0) {
        if (!senderOk) toast.error("Enter sender name and phone to continue");
        else if (form.password.length < 6) toast.error("Password must be at least 6 characters");
        else toast.error("Passwords do not match");
      } else if (step === 1) toast.error("Receiver, province, and collection office are required");
      else if (step === 2) toast.error("Add a parcel description to continue");
      return;
    }
    setAttempted(false);
    setStep((s) => s + 1);
  };

  const submitParcel = async () => {
    if (!senderOk || !receiverOk || !accountOk) {
      setAttempted(true);
      toast.error("Receiver and destination province are required before you can finish");
      if (!receiverOk) setStep(1);
      else if (!senderOk || !accountOk) setStep(0);
      return;
    }

    if (!liveCompany) {
      toast.error("Open the courier share link first", {
        description: "Customers must use /c/company-name so parcels go to the right company.",
      });
      return;
    }

    setSubmitting(true);

    if (checkoutAs === "account" && !fromReception) {
      markCustomerPortalMode(tenant.slug);
      const account = await registerCustomerAccount({
        companyId: tenant.id,
        companySlug: tenant.slug,
        fullName: form.senderName.trim(),
        phone: form.senderPhone.trim(),
        email: form.senderEmail.trim() || null,
        password: form.password,
      });
      if (account.error) {
        setSubmitting(false);
        toast.error("Could not create account", { description: account.error });
        return;
      }
      if (account.needsEmailConfirm) {
        toast.message("Confirm your email", {
          description: "We sent a link — then sign in to see your parcel history.",
        });
      } else {
        await refreshProfileAfterAuth();
        toast.success("Account created — your parcels will stay on this phone");
      }
    }

    if (!branchOptions.length) {
      toast.error(branchesError || "No branches available for this company yet");
      setSubmitting(false);
      return;
    }
    const origin =
      branchOptions.find((b) => b.id === form.originBranchId) ?? branchOptions[0];
    if (!origin) {
      toast.error("Choose a drop-off office");
      setSubmitting(false);
      return;
    }
    const destChoices = destBranchChoices.length ? destBranchChoices : branchOptions;
    const dest =
      destChoices.find((b) => b.id === form.destBranchId) ??
      destChoices.find((b) => b.id === matchBranchForProvince(destChoices, destinationLabel)) ??
      destChoices[0] ??
      origin;
    const destinationId = dest.id;

    const customCategory = isOtherCategory
      ? form.categoryOther.trim()
      : form.category.startsWith("name:")
        ? form.category.slice(5)
        : "";
    let categoryId: string | null = null;
    if (form.category && !isOtherCategory && !form.category.startsWith("name:")) {
      categoryId = form.category;
    } else if (customCategory) {
      categoryId = await resolveParcelCategory(tenant.id, customCategory);
    }

    const created = await createGuestParcel({
      companyId: tenant.id,
      senderName: form.senderName.trim(),
      senderPhone: form.senderPhone.trim(),
      ...(form.senderEmail.trim() ? { senderEmail: form.senderEmail.trim() } : {}),
      receiverName: form.receiverName.trim(),
      receiverPhone: form.receiverPhone.trim(),
      originBranchId: origin.id,
      destinationBranchId: destinationId,
      destinationProvince: destinationLabel,
      description: form.description.trim(),
      declaredValueCents: form.declaredValue
        ? Math.round(Number(form.declaredValue) * 100)
        : 0,
      weightKg: form.weight ? Number(form.weight) : null,
      ...(categoryId ? { categoryId } : {}),
      instructions: [
        form.instructions.trim(),
        customCategory && !categoryId ? `Category: ${customCategory}` : "",
        form.senderNrc.trim() ? `Sender NRC: ${form.senderNrc.trim()}` : "",
        form.quantity.trim() && form.quantity !== "1" ? `Quantity: ${form.quantity.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n") || null,
    });

    setSubmitting(false);

    if (!created || "error" in created) {
      toast.error("Could not register parcel", {
        description:
          created && "error" in created
            ? created.error
            : "Try again, or ask the courier to check their subscription and guest registration.",
      });
      return;
    }

    setTrackingNumber(created.trackingNumber);
    setMode("success");
    if (fromReception) {
      toast.success("Parcel registered — returning to reception");
    }
  };

  if (mode === "choose") {
    return (
      <PortalPage wide receptionDesk={fromReception}>
        <FadeIn className="flex flex-1 flex-col justify-center py-4">
          <div className="mx-auto flex w-full flex-col gap-3 md:gap-5">
            <div className="text-center">
              {fromReception ? (
                <button
                  type="button"
                  onClick={exitToReception}
                  className="inline-flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white md:text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to reception
                </button>
              ) : (
                <Link
                  to="/portal"
                  className="inline-flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white md:text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Link>
              )}
              <h1 className="mt-2 font-display text-xl font-bold tracking-tight text-white md:text-3xl">
                Send a parcel
              </h1>
              <p className="mt-1 text-xs text-white/70 md:text-base">Choose how to continue</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:gap-5">
              <button
                type="button"
                onClick={() => {
                  setCheckoutAs("guest");
                  setForm(empty);
                  setMode("wizard");
                }}
                className="group flex min-h-[4.75rem] items-center gap-3 rounded-2xl border border-white/20 bg-white/95 px-3.5 py-3.5 text-left shadow-lg backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-xl active:translate-y-0 md:min-h-[11.5rem] md:flex-col md:items-start md:justify-between md:p-6"
              >
                <div className="flex w-full items-center gap-3 md:flex-col md:items-start md:gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 md:h-12 md:w-12">
                    <Package className="h-5 w-5 text-slate-700" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground md:text-lg">
                      Continue as guest
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground md:mt-1 md:text-sm">
                      Register immediately — no account needed
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:hidden" />
                </div>
                <ArrowRight className="mt-auto hidden h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 md:block" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setCheckoutAs("account");
                  setForm(empty);
                  setMode("wizard");
                }}
                className="group flex min-h-[4.75rem] w-full flex-col justify-center rounded-2xl border-2 bg-white/95 px-3.5 py-3.5 text-left shadow-lg backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-xl active:translate-y-0 md:min-h-[11.5rem] md:p-6"
                style={{ borderColor: "var(--tenant-primary)" }}
              >
                <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-4">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl md:h-12 md:w-12"
                    style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
                  >
                    <UserRound className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold md:text-lg" style={{ color: "var(--tenant-primary)" }}>
                      Create account
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground md:mt-1 md:text-sm">
                      Faster checkout with {tenant.name}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:hidden" />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/60 pt-2.5 md:mt-auto md:pt-4">
                  {ACCOUNT_BENEFITS.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold md:text-xs"
                      style={{
                        background: "color-mix(in srgb, var(--tenant-primary) 12%, white)",
                        color: "var(--tenant-primary)",
                      }}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      {b}
                    </span>
                  ))}
                </div>
              </button>
            </div>
          </div>
        </FadeIn>
      </PortalPage>
    );
  }

  if (mode === "success") {
    return (
      <PortalPage wide receptionDesk={fromReception}>
        <ScaleIn className="w-full md:mx-auto md:max-w-2xl">
          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-xl backdrop-blur-md">
            <div
              className="px-5 py-8 text-center sm:px-6 sm:py-10"
              style={{ background: "color-mix(in srgb, var(--tenant-primary) 8%, transparent)" }}
            >
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600">
                <PartyPopper className="h-7 w-7" />
              </span>
              <h1 className="mt-4 text-xl font-bold sm:text-2xl">Parcel registered!</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {fromReception
                  ? "Returning to the reception desk…"
                  : `Take this reference to the drop-off branch within 72 hours. Destination: ${destinationLabel || "—"}.`}
              </p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:p-6">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reference number
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-display text-xl font-bold tracking-tight sm:text-2xl">{trackingNumber}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy reference"
                      onClick={() => {
                        const url = getPublicTrackingUrl(trackingNumber);
                        void navigator.clipboard.writeText(url);
                        toast.success("Tracking link copied — send this, not only the code");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <StatusPill status="Waiting for Drop-off" />
                <dl className="grid gap-2 text-sm">
                  <Row label="Receiver" value={form.receiverName} />
                  <Row label="Destination" value={destinationLabel} />
                  <Row label="Fee" value="Confirmed when you drop off" />
                </dl>
                <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Staff will weigh your parcel at the counter and confirm the final amount using the company rate chart.
                </p>
              </div>
              <div className="mx-auto grid h-36 w-36 place-items-center overflow-hidden rounded-2xl border border-border bg-white">
                {trackingNumber ? (
                  <img
                    alt="Tracking QR"
                    className="h-full w-full"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getPublicTrackingUrl(trackingNumber))}`}
                  />
                ) : (
                  <QrCode className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border p-5 sm:p-6">
              {fromReception ? (
                <Button
                  className="h-11 flex-1 rounded-xl sm:h-12"
                  style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
                  onClick={exitToReception}
                >
                  Back to reception now
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    className="h-11 flex-1 rounded-xl sm:h-12"
                    style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
                  >
                    <a href={getPublicTrackingUrl(trackingNumber)}>Track parcel</a>
                  </Button>
                  <Button asChild variant="outline" className="h-11 flex-1 rounded-xl sm:h-12">
                    <a href={getTrackingWhatsAppUrl(trackingNumber, tenant.name)} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp link
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="h-11 flex-1 rounded-xl sm:h-12">
                    <Link to="/portal">Done</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </ScaleIn>
      </PortalPage>
    );
  }

  return (
    <PortalPage wide desk receptionDesk={fromReception}>
      <FadeIn className="flex min-h-0 w-full flex-1 flex-col gap-3 pb-2 sm:gap-4 md:h-full md:gap-3 lg:gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3 md:shrink-0">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                if (fromReception) {
                  exitToReception();
                  return;
                }
                setMode("choose");
              }}
              className="group inline-flex items-center gap-1 text-xs font-medium text-white/75 transition-colors hover:text-white md:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />{" "}
              {fromReception ? "Back to reception" : "Back"}
            </button>
            <h1 className="mt-1.5 font-display text-xl font-bold text-white md:mt-2 md:text-2xl lg:text-3xl xl:text-4xl">
              Send a parcel
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-xs text-white/65 md:text-sm">
                {fromReception ? "Counter" : checkoutAs === "guest" ? "Guest" : "Account"} · Step {step + 1} of 4
              </p>
              {tenant.priceChartUrl ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-white underline-offset-2 hover:underline md:text-sm"
                    >
                      <Table2 className="h-3.5 w-3.5" /> View rates
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle>{tenant.name} rate chart</DialogTitle>
                      <DialogDescription>
                        Fee ranges for reference. Final amount is confirmed at the counter after weighing.
                      </DialogDescription>
                    </DialogHeader>
                    <img
                      src={tenant.priceChartUrl}
                      alt={`${tenant.name} price chart`}
                      className="w-full rounded-xl border border-border"
                    />
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>
          </div>
          <LiveClock className="shrink-0 md:px-4 md:py-2" />
        </div>

        <ol className="grid w-full shrink-0 grid-cols-4 gap-1.5 sm:gap-2 md:mx-auto md:max-w-4xl lg:max-w-5xl">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s} className="relative flex flex-col items-center text-center">
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-[calc(50%+14px)] right-[calc(-50%+14px)] top-[15px] h-0.5 overflow-hidden rounded-full sm:top-[17px] md:top-[19px]"
                    style={{ background: "rgba(255,255,255,0.22)" }}
                  >
                    <span
                      className="block h-full origin-left transition-transform duration-500 ease-out"
                      style={{
                        width: "100%",
                        transform: done ? "scaleX(1)" : "scaleX(0)",
                        background: "color-mix(in srgb, var(--tenant-primary) 85%, white)",
                      }}
                    />
                  </span>
                ) : null}
                <motion.span
                  layout
                  className={cn(
                    "relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-transform duration-200 sm:h-9 sm:w-9 sm:text-sm md:h-10 md:w-10",
                    current && "scale-110",
                  )}
                  style={
                    done || current
                      ? {
                          background: "var(--tenant-primary)",
                          color: "var(--tenant-primary-fg)",
                          boxShadow: current
                            ? "0 0 0 3px color-mix(in srgb, var(--tenant-primary) 40%, transparent), 0 8px 20px -8px color-mix(in srgb, var(--tenant-primary) 70%, transparent)"
                            : "0 4px 12px -4px rgba(0,0,0,0.35)",
                        }
                      : {
                          background: "rgba(255,255,255,0.16)",
                          color: "rgba(255,255,255,0.88)",
                          border: "1.5px solid rgba(255,255,255,0.5)",
                        }
                  }
                >
                  {done ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : i + 1}
                </motion.span>
                <p
                  className={cn(
                    "mt-1.5 w-full truncate text-[10px] font-semibold transition-colors sm:text-xs md:text-sm",
                    current || done ? "text-white" : "text-white/55",
                  )}
                >
                  {s}
                </p>
              </li>
            );
          })}
        </ol>

        <motion.div
          layout
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/20 bg-white/97 p-4 shadow-xl backdrop-blur-md sm:p-5 md:p-6 lg:p-8 xl:p-10"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              {step === 0 ? (
                <div className="grid flex-1 content-start gap-4 sm:grid-cols-2 sm:gap-5 md:gap-6 lg:gap-8 lg:grid-cols-2">
                  <Field
                    label="Full name"
                    value={form.senderName}
                    onChange={set("senderName")}
                    required
                    error={attempted && step === 0 && !form.senderName.trim()}
                    large
                  />
                  <Field
                    label="Phone"
                    value={form.senderPhone}
                    onChange={set("senderPhone")}
                    required
                    error={attempted && step === 0 && !form.senderPhone.trim()}
                    large
                  />
                  <Field label="NRC (optional)" value={form.senderNrc} onChange={set("senderNrc")} large />
                  <Field label="Email (optional)" value={form.senderEmail} onChange={set("senderEmail")} large />
                  {branchOptions.length > 1 ? (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="md:text-sm">
                        Drop-off office <span className="text-[var(--tenant-primary)]">*</span>
                      </Label>
                      <Select
                        value={form.originBranchId || branchOptions[0]?.id}
                        onValueChange={(v) => setForm((f) => ({ ...f, originBranchId: v }))}
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl sm:h-12 md:h-14 md:text-lg">
                          <SelectValue placeholder="Which office receives this parcel?" />
                        </SelectTrigger>
                        <SelectContent>
                          {branchOptions.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {checkoutAs === "account" && !fromReception ? (
                    <>
                      <Field
                        label="Password"
                        value={form.password}
                        onChange={set("password")}
                        required
                        error={attempted && step === 0 && form.password.length < 6}
                        large
                        type="password"
                      />
                      <Field
                        label="Confirm password"
                        value={form.passwordConfirm}
                        onChange={set("passwordConfirm")}
                        required
                        error={
                          attempted &&
                          step === 0 &&
                          (form.passwordConfirm.length < 6 || form.password !== form.passwordConfirm)
                        }
                        large
                        type="password"
                      />
                    </>
                  ) : null}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="grid flex-1 content-start gap-4 sm:grid-cols-2 sm:gap-5 md:gap-6 lg:gap-8">
                  <Field
                    label="Full name"
                    value={form.receiverName}
                    onChange={set("receiverName")}
                    required
                    error={attempted && step === 1 && !form.receiverName.trim()}
                    large
                  />
                  <Field
                    label="Phone"
                    value={form.receiverPhone}
                    onChange={set("receiverPhone")}
                    required
                    error={attempted && step === 1 && !form.receiverPhone.trim()}
                    large
                  />
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="md:text-sm">
                      Destination province <span className="text-[var(--tenant-primary)]">*</span>
                    </Label>
                    <Select
                      value={form.destination}
                      onValueChange={(v) => {
                        const picks = branchesForProvince(branchOptions, v === OTHER_PROVINCE_VALUE ? "" : v);
                        setForm((f) => ({
                          ...f,
                          destination: v,
                          destinationOther: v === OTHER_PROVINCE_VALUE ? f.destinationOther : "",
                          destBranchId: picks.length === 1 ? picks[0]!.id : picks.some((p) => p.id === f.destBranchId) ? f.destBranchId : picks[0]?.id ?? "",
                        }));
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-11 w-full rounded-xl border-border/80 bg-background text-base transition-all hover:border-[var(--tenant-primary)]/40 focus:ring-[var(--tenant-primary)] sm:h-12 md:h-14 md:text-lg",
                          attempted &&
                            step === 1 &&
                            !destinationOk &&
                            "border-destructive ring-1 ring-destructive/30",
                        )}
                      >
                        <SelectValue placeholder="Select province" />
                      </SelectTrigger>
                      <SelectContent>
                        {DESTINATION_PROVINCES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                        <SelectItem value={OTHER_PROVINCE_VALUE}>Other — type province</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.destination === OTHER_PROVINCE_VALUE ? (
                      <Input
                        value={form.destinationOther}
                        onChange={(e) => set("destinationOther")(e.target.value)}
                        placeholder="Type the province or district"
                        className={cn(
                          "mt-2 h-11 rounded-xl border-border/80 text-base sm:h-12 md:h-14 md:text-lg",
                          attempted &&
                            step === 1 &&
                            !form.destinationOther.trim() &&
                            "border-destructive ring-1 ring-destructive/30",
                        )}
                      />
                    ) : null}
                    {attempted && step === 1 && !destinationOk ? (
                      <p className="text-xs text-destructive">Destination province is required</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Where the receiver is. If your province is missing, choose Other and type it.
                      </p>
                    )}
                  </div>
                  {destBranchChoices.length ? (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="md:text-sm">
                        Collect at office <span className="text-[var(--tenant-primary)]">*</span>
                      </Label>
                      <Select
                        value={form.destBranchId || destBranchChoices[0]?.id}
                        onValueChange={(v) => setForm((f) => ({ ...f, destBranchId: v }))}
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl sm:h-12 md:h-14 md:text-lg">
                          <SelectValue placeholder="Which office will they collect from?" />
                        </SelectTrigger>
                        <SelectContent>
                          {destBranchChoices.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid flex-1 content-start gap-4 overflow-y-auto sm:grid-cols-2 sm:gap-5 md:gap-6 lg:gap-8">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="md:text-sm">
                      Parcel description <span className="text-[var(--tenant-primary)]">*</span>
                    </Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => set("description")(e.target.value)}
                      className={cn(
                        "min-h-20 rounded-xl border-border/80 text-base transition-all hover:border-[var(--tenant-primary)]/40 focus-visible:ring-[var(--tenant-primary)] md:min-h-28 md:text-lg",
                        attempted && step === 2 && !form.description.trim() && "border-destructive",
                      )}
                      placeholder="What's inside the parcel?"
                    />
                  </div>
                  <Field label="Declared value (ZMW)" value={form.declaredValue} onChange={set("declaredValue")} large />
                  <div className="space-y-1.5">
                    <Label className="md:text-sm">Category</Label>
                    <Select
                      value={form.category || undefined}
                      onValueChange={(v) => setForm((f) => ({ ...f, category: v, categoryOther: v === OTHER_CATEGORY_VALUE ? f.categoryOther : "" }))}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl border-border/80 bg-background transition-all hover:border-[var(--tenant-primary)]/40 focus:ring-[var(--tenant-primary)] sm:h-12 md:h-14 md:text-lg">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={OTHER_CATEGORY_VALUE}>Other — type your own</SelectItem>
                      </SelectContent>
                    </Select>
                    {isOtherCategory ? (
                      <Input
                        value={form.categoryOther}
                        onChange={(e) => set("categoryOther")(e.target.value)}
                        placeholder="Type the category (e.g. Furniture)"
                        className="h-11 rounded-xl border-border/80 text-base sm:h-12 md:h-14 md:text-lg"
                      />
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Pick one from the list, or choose Other and type it.
                    </p>
                  </div>
                  <Field label="Quantity" value={form.quantity} onChange={set("quantity")} large />
                  <Field label="Weight kg (optional)" value={form.weight} onChange={set("weight")} large />
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="md:text-sm">Special instructions</Label>
                    <Textarea
                      value={form.instructions}
                      onChange={(e) => set("instructions")(e.target.value)}
                      className="min-h-16 rounded-xl border-border/80 transition-all hover:border-[var(--tenant-primary)]/40 focus-visible:ring-[var(--tenant-primary)] md:min-h-20 md:text-lg"
                      placeholder="Fragile, keep upright…"
                    />
                    <p className="text-xs text-muted-foreground">
                      Weight is confirmed at the counter. Use{" "}
                      {tenant.priceChartUrl ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <button type="button" className="font-medium text-[var(--tenant-primary)] underline-offset-2 hover:underline">
                              View rates
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
                            <DialogHeader>
                              <DialogTitle>{tenant.name} rate chart</DialogTitle>
                              <DialogDescription>
                                Ranges only — final fee confirmed at drop-off.
                              </DialogDescription>
                            </DialogHeader>
                            <img
                              src={tenant.priceChartUrl}
                              alt={`${tenant.name} price chart`}
                              className="w-full rounded-xl border border-border"
                            />
                          </DialogContent>
                        </Dialog>
                      ) : (
                        "the branch rate chart"
                      )}{" "}
                      for fee ranges.
                    </p>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3 md:gap-4">
                    <ReviewBlock title="Sender" rows={[["Name", form.senderName], ["Phone", form.senderPhone]]} />
                    <ReviewBlock
                      title="Receiver"
                      rows={[
                        ["Name", form.receiverName],
                        ["Phone", form.receiverPhone],
                        ["Province", destinationLabel],
                      ]}
                    />
                    <ReviewBlock
                      title="Parcel"
                      rows={[
                        ["Description", form.description],
                        ["Category", categoryLabel],
                        ["Value", form.declaredValue ? `ZMW ${form.declaredValue}` : "—"],
                      ]}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">Delivery fee</p>
                      <p className="text-muted-foreground">Confirmed when you drop off — staff weigh and apply the rate chart.</p>
                    </div>
                    {tenant.priceChartUrl ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="rounded-xl shrink-0">
                            <Table2 className="mr-1.5 h-3.5 w-3.5" /> View rates
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
                          <DialogHeader>
                            <DialogTitle>{tenant.name} rate chart</DialogTitle>
                            <DialogDescription>
                              Ranges only — final fee confirmed at drop-off after weighing.
                            </DialogDescription>
                          </DialogHeader>
                          <img
                            src={tenant.priceChartUrl}
                            alt={`${tenant.name} price chart`}
                            className="w-full rounded-xl border border-border"
                          />
                        </DialogContent>
                      </Dialog>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <div className="mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-border pt-4 sm:pt-5 md:pt-6">
            <Button
              variant="ghost"
              className="group h-11 rounded-xl px-4 transition-colors hover:bg-muted md:h-12 md:px-5 md:text-base"
              onClick={() => {
                if (step > 0) {
                  setStep((s) => s - 1);
                  return;
                }
                if (fromReception) {
                  exitToReception();
                  return;
                }
                setMode("choose");
              }}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />{" "}
              {step === 0 && fromReception ? "Reception" : "Back"}
            </Button>
            {step < 3 ? (
              <Button
                className="group h-11 rounded-xl px-5 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:h-12 sm:px-7 md:h-14 md:px-10 md:text-base"
                style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
                onClick={goNext}
              >
                Continue <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            ) : (
              <Button
                className="group h-11 rounded-xl px-5 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:h-12 sm:px-7 md:h-14 md:px-10 md:text-base"
                style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
                disabled={submitting}
                onClick={() => void submitParcel()}
              >
                <Check className="mr-1.5 h-4 w-4" /> {submitting ? "Submitting…" : "Submit"}
              </Button>
            )}
          </div>
        </motion.div>
      </FadeIn>
    </PortalPage>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  large,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  large?: boolean;
  type?: "text" | "password";
}) {
  return (
    <div className="space-y-1.5">
      <Label className={cn("text-foreground/90", large && "md:text-sm")}>
        {label}
        {required ? <span className="text-[var(--tenant-primary)]"> *</span> : ""}
      </Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 rounded-xl border-border/80 bg-background text-base shadow-sm transition-all duration-200 hover:border-[var(--tenant-primary)]/45 focus-visible:border-[var(--tenant-primary)] focus-visible:ring-2 focus-visible:ring-[var(--tenant-primary)]/25 sm:h-12",
          large && "md:h-14 md:text-lg",
          error && "border-destructive ring-1 ring-destructive/30",
        )}
      />
      {error ? <p className="text-xs text-destructive">This field is required</p> : null}
    </div>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--tenant-primary)]/35 hover:bg-muted/50 hover:shadow-md sm:p-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--tenant-primary)" }}
      >
        {title}
      </h3>
      <dl className="mt-2.5 grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
