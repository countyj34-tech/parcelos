import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Loader2, MessageSquare, Smartphone } from "lucide-react";
import { PaymentProviderIcon } from "@/components/billing/payment-provider-icon";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchCompanyBilling,
  formatPlanPrice,
  startGenesysCheckout,
  submitGenesysHostedCheckout,
  type CompanyBillingState,
} from "@/lib/api/billing";
import {
  claimManualSaasPayment,
  listBillingAddons,
  listPlatformPaymentAccounts,
  quoteSaasCheckout,
  startManualSaasPayment,
  type BillingAddon,
  type CheckoutQuote,
  type ManualPaymentStart,
  type PlatformPaymentAccount,
} from "@/lib/api/platform-billing";
import { toast } from "sonner";

export const Route = createFileRoute("/app/subscription")({
  validateSearch: (s: Record<string, unknown>) => ({
    paid: s.paid === "1" || s.paid === true ? ("1" as const) : undefined,
    tx_ref: typeof s.tx_ref === "string" ? s.tx_ref : undefined,
  }),
  head: () => ({
    meta: [{ title: "Subscription — ParcelOS" }],
  }),
  component: SubscriptionPage,
});

const PLANS = [
  {
    code: "starter",
    name: "Starter",
    blurb: "1 branch · core ops",
    priceCents: 70000,
    highlights: ["Reception & parcels", "Customer portal + QR", "Staff invites"],
  },
  {
    code: "professional",
    name: "Professional",
    blurb: "Multi-branch · dispatch",
    priceCents: 150000,
    highlights: ["Dispatch & fleet", "Reports", "Priority support"],
  },
] as const;

const MONTH_OPTIONS = [
  { value: 1, label: "1 month" },
  { value: 2, label: "2 months" },
  { value: 3, label: "3 months · ~3% off" },
  { value: 6, label: "6 months · ~8% off" },
  { value: 12, label: "12 months · ~15% off" },
];

function SubscriptionPage() {
  const { paid, tx_ref } = Route.useSearch();
  const [billing, setBilling] = useState<CompanyBillingState | null>(null);
  const [accounts, setAccounts] = useState<PlatformPaymentAccount[]>([]);
  const [addons, setAddons] = useState<BillingAddon[]>([]);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [planCode, setPlanCode] = useState("starter");
  const [months, setMonths] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [manual, setManual] = useState<ManualPaymentStart | null>(null);
  const [payerNote, setPayerNote] = useState("");
  const [claimed, setClaimed] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [state, acc, ads] = await Promise.all([
      fetchCompanyBilling(),
      listPlatformPaymentAccounts(),
      listBillingAddons(),
    ]);
    setBilling(state);
    setAccounts(acc);
    setAddons(ads);
    if (acc[0] && !selectedAccountId) setSelectedAccountId(acc[0].id);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paid) {
      toast.success("Payment received — activating workspace", {
        description: tx_ref ? `Ref ${tx_ref}` : undefined,
      });
      const t = window.setTimeout(() => void refresh(), 2500);
      return () => window.clearTimeout(t);
    }
  }, [paid, tx_ref]);

  useEffect(() => {
    let cancelled = false;
    void quoteSaasCheckout({ planCode, months, addonCodes: selectedAddons }).then((q) => {
      if (!cancelled) setQuote(q);
    });
    return () => {
      cancelled = true;
    };
  }, [planCode, months, selectedAddons]);

  const momo = useMemo(() => accounts.filter((a) => a.kind === "mobile_money"), [accounts]);
  const banks = useMemo(() => accounts.filter((a) => a.kind === "bank"), [accounts]);
  const selected = accounts.find((a) => a.id === selectedAccountId) ?? null;
  const smsAddons = addons.filter((a) => a.kind === "sms_pack" || a.kind === "sms_bulk");
  const waAddons = addons.filter((a) => a.kind === "whatsapp");

  const toggleAddon = (code: string, exclusiveKind?: string) => {
    setSelectedAddons((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (exclusiveKind === "whatsapp") {
        const waCodes = new Set(waAddons.map((a) => a.code));
        return [...prev.filter((c) => !waCodes.has(c)), code];
      }
      if (exclusiveKind === "sms") {
        const smsCodes = new Set(smsAddons.map((a) => a.code));
        return [...prev.filter((c) => !smsCodes.has(c)), code];
      }
      return [...prev, code];
    });
    setManual(null);
    setClaimed(false);
  };

  const onPayGenesys = async () => {
    setBusy("genesys");
    try {
      const payload = await startGenesysCheckout({
        planCode,
        months,
        addonCodes: selectedAddons,
        mode: "hosted",
      });
      if (payload.error) {
        toast.error(payload.error);
        return;
      }
      toast.message("Opening secure MoMo checkout…");
      submitGenesysHostedCheckout(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout");
    } finally {
      setBusy(null);
    }
  };

  const onStartManual = async () => {
    if (!selectedAccountId) {
      toast.error("Select MTN, Airtel, Zamtel, or a bank");
      return;
    }
    setBusy("manual");
    try {
      const intent = await startManualSaasPayment({
        planCode,
        accountId: selectedAccountId,
        months,
        addonCodes: selectedAddons,
      });
      setManual(intent);
      setClaimed(false);
      toast.success("Payment reference ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      setBusy(null);
    }
  };

  const onClaim = async () => {
    if (!manual) return;
    setBusy("claim");
    try {
      await claimManualSaasPayment(manual.txRef, selectedAccountId || null, payerNote);
      setClaimed(true);
      toast.success("Marked as paid — we will confirm and unlock");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    toast.success(`${label} copied`);
  };

  const days = billing?.daysLeft;
  const onTrial = billing?.companyStatus === "trial" || billing?.subscriptionStatus === "trialing";
  const active = billing?.companyStatus === "active" || billing?.subscriptionStatus === "active";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        description={
          loading
            ? "Loading…"
            : onTrial
              ? `${days ?? 0} days left on trial — pick months, SMS & WhatsApp, then pay`
              : active
                ? "Renew or top up SMS / WhatsApp"
                : "Choose plan length and messaging, then pay by MoMo or bank"
        }
      />

      {billing?.locked ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Workspace locked — complete payment below to reopen.
        </p>
      ) : null}

      {onTrial && days != null ? (
        <div className="card-elevated p-5">
          <div className="mb-2 flex justify-between text-sm">
            <span>Trial progress</span>
            <span className="text-muted-foreground">{Math.max(0, 14 - days)} / 14 days used</span>
          </div>
          <Progress value={Math.min(100, ((14 - days) / 14) * 100)} className="h-2" />
        </div>
      ) : null}

      {/* Plan + duration */}
      <div className="grid gap-4 lg:grid-cols-2">
        {PLANS.map((plan) => (
          <button
            key={plan.code}
            type="button"
            onClick={() => {
              setPlanCode(plan.code);
              setManual(null);
            }}
            className={`rounded-2xl border p-5 text-left shadow-card transition ${
              planCode === plan.code ? "border-teal-600 bg-teal-600/5 ring-1 ring-teal-600/30" : "border-border bg-card"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.blurb}</p>
              </div>
              <p className="font-display text-xl font-bold">{formatPlanPrice(plan.priceCents, "ZMW")}<span className="text-sm font-medium text-muted-foreground">/mo</span></p>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {plan.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-teal-700" /> {h}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="card-elevated space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>How long?</Label>
            <Select
              value={String(months)}
              onValueChange={(v) => {
                setMonths(Number(v));
                setManual(null);
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Live total</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {quote ? formatPlanPrice(quote.totalCents, quote.currencyCode) : "…"}
            </p>
            {quote && quote.discountFactor < 1 ? (
              <p className="text-xs text-emerald-700">Multi-month discount applied ({Math.round((1 - quote.discountFactor) * 100)}% off plan)</p>
            ) : null}
          </div>
        </div>

        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <MessageSquare className="h-4 w-4 text-teal-700" /> SMS (Africa&apos;s Talking)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Bill is split automatically: AT network cost reserved for Africa&apos;s Talking, margin stays with ParcelOS.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {smsAddons.map((a) => {
              const on = selectedAddons.includes(a.code);
              return (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => toggleAddon(a.code, "sms")}
                  className={`rounded-xl border p-3 text-left ${on ? "border-teal-600 bg-teal-600/5" : "border-border"}`}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox checked={on} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                      <p className="mt-1 text-sm font-bold">{formatPlanPrice(a.priceCents, "ZMW")}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Smartphone className="h-4 w-4 text-teal-700" /> WhatsApp updates
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {waAddons.map((a) => {
              const on = selectedAddons.includes(a.code);
              return (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => toggleAddon(a.code, "whatsapp")}
                  className={`rounded-xl border p-3 text-left ${on ? "border-teal-600 bg-teal-600/5" : "border-border"}`}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox checked={on} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                      <p className="mt-1 text-sm font-bold">{formatPlanPrice(a.priceCents, "ZMW")}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {quote ? (
          <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">To ParcelOS (you)</p>
              <p className="font-semibold">{formatPlanPrice(quote.amountPlatformCents, "ZMW")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Africa&apos;s Talking reserve</p>
              <p className="font-semibold">{formatPlanPrice(quote.amountProviderCents, "ZMW")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Includes</p>
              <p className="font-semibold">
                {quote.months} mo
                {quote.smsCredits ? ` · ${quote.smsCredits.toLocaleString()} SMS` : ""}
                {quote.whatsappMonths ? ` · WA ${quote.whatsappMonths} mo` : ""}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card-elevated space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Pay instantly (recommended)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            MTN / Airtel / Zamtel via GenesysPay — unlocks automatically when payment succeeds. No waiting for manual confirm.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PaymentProviderIcon provider="mtn" size={36} />
          <PaymentProviderIcon provider="airtel" size={36} />
          <PaymentProviderIcon provider="zamtel" size={36} />
        </div>
        <Button
          size="lg"
          className="rounded-xl"
          disabled={!!busy || !quote}
          onClick={() => void onPayGenesys()}
        >
          {busy === "genesys" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Pay {quote ? formatPlanPrice(quote.totalCents, quote.currencyCode) : ""} with Mobile Money
        </Button>
      </div>

      {/* Manual fallback — direct to your numbers */}
      <div className="card-elevated space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">Or pay direct to our numbers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Transfer manually, then tap “I have paid”. We confirm in Admin → Billing.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Mobile Money</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {momo.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAccountId(a.id)}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  selectedAccountId === a.id ? "border-teal-600 bg-teal-600/5 ring-1 ring-teal-600/20" : "border-border"
                }`}
              >
                <PaymentProviderIcon provider={a.iconKey || a.provider} size={48} />
                <div className="min-w-0">
                  <p className="font-semibold">{a.label}</p>
                  <p className="truncate font-mono text-sm">{a.accountNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.accountName}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Banks</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {banks.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAccountId(a.id)}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  selectedAccountId === a.id ? "border-teal-600 bg-teal-600/5 ring-1 ring-teal-600/20" : "border-border"
                }`}
              >
                <PaymentProviderIcon provider={a.iconKey || a.provider} size={48} />
                <div className="min-w-0">
                  <p className="font-semibold">{a.label}</p>
                  <p className="truncate font-mono text-sm">{a.accountNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.accountName}
                    {a.bankBranch ? ` · ${a.bankBranch}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {!accounts.length ? (
          <p className="text-sm text-muted-foreground">Payment accounts appear after Admin → Billing is configured.</p>
        ) : null}

        <Button className="rounded-xl" disabled={!!busy || !selectedAccountId} onClick={() => void onStartManual()}>
          {busy === "manual" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Get payment reference
        </Button>

        {manual ? (
          <div className="space-y-4 rounded-2xl border border-teal-600/30 bg-teal-600/5 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-200">Reference</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-background px-3 py-2 text-lg font-bold">{manual.txRef}</code>
                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void copy(manual.txRef, "Reference")}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <p className="mt-2 text-sm">
                Send <strong>{formatPlanPrice(Math.round(manual.amountMajor * 100), manual.currencyCode)}</strong> via{" "}
                <strong>{selected?.label}</strong>
                {selected ? (
                  <>
                    {" "}
                    (<span className="inline-flex align-middle">
                      <PaymentProviderIcon provider={selected.iconKey || selected.provider} size={22} />
                    </span>{" "}
                    <span className="font-mono">{selected.accountNumber}</span>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Of which ≈ K{manual.amountPlatform.toLocaleString("en-ZM")} ParcelOS · K
                {manual.amountProvider.toLocaleString("en-ZM")} Africa&apos;s Talking
                {manual.smsCredits ? ` · ${manual.smsCredits.toLocaleString()} SMS` : ""}
                {manual.whatsappMonths ? ` · WhatsApp ${manual.whatsappMonths} mo` : ""}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Optional note (txn ID)</Label>
              <Input className="rounded-xl" value={payerNote} onChange={(e) => setPayerNote(e.target.value)} />
            </div>
            <Button className="rounded-xl" disabled={!!busy || claimed} onClick={() => void onClaim()}>
              {busy === "claim" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {claimed ? "Waiting for confirmation…" : "I have paid"}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Need help? <Link to="/app/support" className="underline">Support</Link>
      </p>
    </div>
  );
}
