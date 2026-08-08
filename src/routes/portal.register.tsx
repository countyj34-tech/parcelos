import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
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
import { createGuestParcel, listCompanyBranches } from "@/lib/api/parcels";
import { BRANCHES, CATEGORIES } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/register")({
  head: () => ({
    meta: [{ title: "Send a parcel" }, { name: "description", content: "Register your parcel online" }],
  }),
  component: RegisterParcel,
});

const STEPS = ["Sender", "Receiver", "Parcel", "Review"];

type Mode = "choose" | "wizard" | "success";
type CheckoutAs = "guest" | "account" | null;

type FormState = {
  senderName: string;
  senderPhone: string;
  senderNrc: string;
  senderEmail: string;
  receiverName: string;
  receiverPhone: string;
  destination: string;
  description: string;
  declaredValue: string;
  category: string;
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
  description: "",
  declaredValue: "",
  category: "",
  weight: "",
  quantity: "1",
  instructions: "",
};

const accountDefaults: FormState = {
  ...empty,
  senderName: "Chanda Mulenga",
  senderPhone: "+260 977 214 880",
  senderNrc: "224114/68/1",
  senderEmail: "chanda.mulenga@zamtel.zm",
};

const ACCOUNT_BENEFITS = [
  "Parcel history",
  "Saved receivers",
  "Faster checkout",
  "Notifications",
] as const;

function PortalPage({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  const { tenant } = useTenant();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
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

      <TenantHeader transparent wide compact />

      <main
        className={cn(
          "relative z-10 mx-auto flex w-full flex-1 flex-col px-4 sm:px-6 lg:px-8",
          wide
            ? "max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl md:justify-center md:py-6"
            : "max-w-md sm:max-w-lg",
        )}
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
    </div>
  );
}

function RegisterParcel() {
  const { tenant } = useTenant();
  const [mode, setMode] = useState<Mode>("choose");
  const [checkoutAs, setCheckoutAs] = useState<CheckoutAs>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("POS-249079-ZM");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string }>>([]);
  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const liveCompany = isSupabaseConfigured() && /^[0-9a-f-]{36}$/i.test(tenant.id);

  useEffect(() => {
    if (!liveCompany) {
      setBranchOptions(BRANCHES.map((name) => ({ id: name, name })));
      return;
    }
    let cancelled = false;
    void listCompanyBranches(tenant.id).then((rows) => {
      if (cancelled) return;
      if (rows.length) {
        setBranchOptions(rows.map((b) => ({ id: b.id, name: b.name })));
      } else {
        setBranchOptions(BRANCHES.map((name) => ({ id: name, name })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [liveCompany, tenant.id]);

  const destinationLabel =
    branchOptions.find((b) => b.id === form.destination)?.name ?? form.destination;

  const senderOk = Boolean(form.senderName.trim() && form.senderPhone.trim());
  const receiverOk = Boolean(
    form.receiverName.trim() && form.receiverPhone.trim() && form.destination.trim(),
  );
  const parcelOk = Boolean(form.description.trim());

  const canContinue = () => {
    if (step === 0) return senderOk;
    if (step === 1) return receiverOk;
    if (step === 2) return parcelOk;
    return receiverOk && senderOk;
  };

  const goNext = () => {
    if (!canContinue()) {
      setAttempted(true);
      if (step === 0) toast.error("Enter sender name and phone to continue");
      else if (step === 1) toast.error("Receiver name, phone and destination branch are required");
      else if (step === 2) toast.error("Add a parcel description to continue");
      return;
    }
    setAttempted(false);
    setStep((s) => s + 1);
  };

  const submitParcel = async () => {
    if (!senderOk || !receiverOk) {
      setAttempted(true);
      toast.error("Receiver and destination are required before you can finish");
      if (!receiverOk) setStep(1);
      else if (!senderOk) setStep(0);
      return;
    }

    if (!liveCompany) {
      setTrackingNumber(`POS-${Math.floor(100000 + Math.random() * 900000)}-ZM`);
      setMode("success");
      return;
    }

    setSubmitting(true);
    const origin = branchOptions[0];
    if (!origin) {
      toast.error("No branches available for this company yet");
      setSubmitting(false);
      return;
    }

    const created = await createGuestParcel({
      companyId: tenant.id,
      senderName: form.senderName.trim(),
      senderPhone: form.senderPhone.trim(),
      ...(form.senderEmail.trim() ? { senderEmail: form.senderEmail.trim() } : {}),
      receiverName: form.receiverName.trim(),
      receiverPhone: form.receiverPhone.trim(),
      originBranchId: origin.id,
      destinationBranchId: form.destination,
      description: form.description.trim(),
      declaredValueCents: form.declaredValue
        ? Math.round(Number(form.declaredValue) * 100)
        : 0,
      weightKg: form.weight ? Number(form.weight) : null,
      ...(form.instructions.trim() ? { instructions: form.instructions.trim() } : {}),
    });

    setSubmitting(false);

    if (!created) {
      toast.error("Could not register parcel", {
        description: "Company may be paused, or guest registration is disabled.",
      });
      return;
    }

    setTrackingNumber(created.trackingNumber);
    setMode("success");
  };

  if (mode === "choose") {
    return (
      <PortalPage wide>
        <FadeIn className="flex flex-1 flex-col justify-center py-4">
          <div className="mx-auto flex w-full flex-col gap-3 md:gap-5">
            <div className="text-center">
              <Link
                to="/portal"
                className="inline-flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white md:text-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Link>
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
                  setForm(accountDefaults);
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
      <PortalPage wide>
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
                Take this reference to {destinationLabel || "your branch"} within 72 hours.
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
                        void navigator.clipboard.writeText(trackingNumber);
                        toast.success("Reference copied");
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
              <div className="mx-auto grid h-32 w-32 place-items-center rounded-2xl border border-dashed border-border bg-muted/40">
                <div className="text-center text-muted-foreground">
                  <QrCode className="mx-auto h-12 w-12" />
                  <p className="mt-2 text-xs">QR code</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border p-5 sm:p-6">
              <Button
                asChild
                className="h-11 flex-1 rounded-xl sm:h-12"
                style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
              >
                <Link to="/portal/track">Track parcel</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 flex-1 rounded-xl sm:h-12">
                <Link to="/portal">Done</Link>
              </Button>
            </div>
          </div>
        </ScaleIn>
      </PortalPage>
    );
  }

  return (
    <PortalPage wide>
      <FadeIn className="flex w-full flex-col gap-3 pb-2 sm:gap-4 md:gap-5">
        <div>
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="group inline-flex items-center gap-1 text-xs font-medium text-white/75 transition-colors hover:text-white md:text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back
          </button>
          <h1 className="mt-2 font-display text-xl font-bold text-white md:text-2xl lg:text-3xl">
            Send a parcel
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs text-white/65 md:text-sm">
              {checkoutAs === "guest" ? "Guest" : "Account"} · Step {step + 1} of 4
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

        <ol className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s} className="relative flex flex-col items-center text-center">
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-[calc(50%+14px)] right-[calc(-50%+14px)] top-[15px] h-0.5 overflow-hidden rounded-full sm:top-[17px]"
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
                    "relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-transform duration-200 sm:h-9 sm:w-9 sm:text-sm",
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
                    "mt-1.5 w-full truncate text-[10px] font-semibold transition-colors sm:text-xs",
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
          className="rounded-2xl border border-white/20 bg-white/97 p-4 shadow-xl backdrop-blur-md transition-shadow duration-300 hover:shadow-2xl sm:p-5 md:p-6 lg:p-8"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
                  <Field
                    label="Full name"
                    value={form.senderName}
                    onChange={set("senderName")}
                    required
                    error={attempted && step === 0 && !form.senderName.trim()}
                  />
                  <Field
                    label="Phone"
                    value={form.senderPhone}
                    onChange={set("senderPhone")}
                    required
                    error={attempted && step === 0 && !form.senderPhone.trim()}
                  />
                  <Field label="NRC (optional)" value={form.senderNrc} onChange={set("senderNrc")} />
                  <Field label="Email (optional)" value={form.senderEmail} onChange={set("senderEmail")} />
                </div>
              ) : null}

              {step === 1 ? (
                <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
                  <Field
                    label="Full name"
                    value={form.receiverName}
                    onChange={set("receiverName")}
                    required
                    error={attempted && step === 1 && !form.receiverName.trim()}
                  />
                  <Field
                    label="Phone"
                    value={form.receiverPhone}
                    onChange={set("receiverPhone")}
                    required
                    error={attempted && step === 1 && !form.receiverPhone.trim()}
                  />
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>
                      Destination branch <span className="text-[var(--tenant-primary)]">*</span>
                    </Label>
                    <Select value={form.destination} onValueChange={set("destination")}>
                      <SelectTrigger
                        className={cn(
                          "h-11 w-full rounded-xl border-border/80 bg-background text-base transition-all hover:border-[var(--tenant-primary)]/40 focus:ring-[var(--tenant-primary)] sm:h-12",
                          attempted && step === 1 && !form.destination && "border-destructive ring-1 ring-destructive/30",
                        )}
                      >
                        <SelectValue placeholder="Select where the parcel is going" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchOptions.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {attempted && step === 1 && !form.destination ? (
                      <p className="text-xs text-destructive">Destination branch is required</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Required — this is where the receiver will collect the parcel.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>
                      Parcel description <span className="text-[var(--tenant-primary)]">*</span>
                    </Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => set("description")(e.target.value)}
                      className={cn(
                        "min-h-20 rounded-xl border-border/80 text-base transition-all hover:border-[var(--tenant-primary)]/40 focus-visible:ring-[var(--tenant-primary)] md:min-h-24",
                        attempted && step === 2 && !form.description.trim() && "border-destructive",
                      )}
                      placeholder="What's inside the parcel?"
                    />
                  </div>
                  <Field label="Declared value (ZMW)" value={form.declaredValue} onChange={set("declaredValue")} />
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={set("category")}>
                      <SelectTrigger className="h-11 w-full rounded-xl border-border/80 bg-background transition-all hover:border-[var(--tenant-primary)]/40 focus:ring-[var(--tenant-primary)] sm:h-12">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Field label="Quantity" value={form.quantity} onChange={set("quantity")} />
                  <Field label="Weight kg (optional)" value={form.weight} onChange={set("weight")} />
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Special instructions</Label>
                    <Textarea
                      value={form.instructions}
                      onChange={(e) => set("instructions")(e.target.value)}
                      className="min-h-16 rounded-xl border-border/80 transition-all hover:border-[var(--tenant-primary)]/40 focus-visible:ring-[var(--tenant-primary)]"
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
                        ["Branch", destinationLabel],
                      ]}
                    />
                    <ReviewBlock
                      title="Parcel"
                      rows={[
                        ["Description", form.description],
                        ["Category", form.category],
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

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 sm:mt-6 sm:pt-5 md:mt-8">
            <Button
              variant="ghost"
              className="group rounded-xl transition-colors hover:bg-muted"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back
            </Button>
            {step < 3 ? (
              <Button
                className="group h-11 rounded-xl px-5 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:h-12 sm:px-7"
                style={{ background: "var(--tenant-primary)", color: "var(--tenant-primary-fg)" }}
                onClick={goNext}
              >
                Continue <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            ) : (
              <Button
                className="group h-11 rounded-xl px-5 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:h-12 sm:px-7"
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground/90">
        {label}
        {required ? <span className="text-[var(--tenant-primary)]"> *</span> : ""}
      </Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 rounded-xl border-border/80 bg-background text-base shadow-sm transition-all duration-200 hover:border-[var(--tenant-primary)]/45 focus-visible:border-[var(--tenant-primary)] focus-visible:ring-2 focus-visible:ring-[var(--tenant-primary)]/25 sm:h-12",
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
