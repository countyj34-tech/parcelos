import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, PartyPopper } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateCompany } from "@/hooks/use-companies";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = ["Company", "Branding", "Workspace", "Subscription", "Administrator"];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type FormState = {
  name: string;
  registration_number: string;
  country_code: string;
  currency_code: string;
  phone: string;
  email: string;
  website: string;
  primary_color: string;
  secondary_color: string;
  subdomain: string;
  slug: string;
  default_language: string;
  timezone: string;
  plan_code: string;
  trial_days: number;
  trial_enabled: boolean;
  admin_full_name: string;
  admin_email: string;
  admin_phone: string;
};

const INITIAL: FormState = {
  name: "",
  registration_number: "",
  country_code: "ZM",
  currency_code: "ZMW",
  phone: "",
  email: "",
  website: "",
  primary_color: "#0F766E",
  secondary_color: "#F59E0B",
  subdomain: "",
  slug: "",
  default_language: "en",
  timezone: "Africa/Lusaka",
  plan_code: "starter",
  trial_days: 14,
  trial_enabled: true,
  admin_full_name: "",
  admin_email: "",
  admin_phone: "",
};

export function CreateCompanyWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [result, setResult] = useState<{ loginUrl: string; name: string } | null>(null);
  const createCompany = useCreateCompany();

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleNameChange = (name: string) => {
    const slug = slugify(name);
    set({
      name,
      slug,
      subdomain: slug ? `${slug}.parcelos.africa` : "",
    });
  };

  const handleSubmit = async () => {
    if (!isSupabaseConfigured()) {
      setResult({ loginUrl: `${form.subdomain}/login`, name: form.name || "New Company" });
      toast.message("Demo mode — company not persisted. Configure Supabase to save.");
      return;
    }

    try {
      const res = await createCompany.mutateAsync({
        name: form.name,
        code: form.name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "NEW",
        slug: form.slug,
        country_code: form.country_code,
        currency_code: form.currency_code,
        phone: form.phone || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        subdomain: form.subdomain,
        default_language: form.default_language,
        timezone: form.timezone,
        plan_code: form.plan_code,
        trial_days: form.trial_enabled ? form.trial_days : 0,
        admin_full_name: form.admin_full_name,
        admin_email: form.admin_email,
        admin_phone: form.admin_phone || undefined,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
      });
      setResult({ loginUrl: res.loginUrl, name: form.name });
      toast.success("Company workspace created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create company");
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-card">
          <PartyPopper className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold">Workspace created</h1>
          <p className="mt-2 text-muted-foreground">{result.name} is ready on ParcelOS.</p>
          <div className="mt-6 rounded-lg bg-muted/50 p-4 text-left text-sm">
            <p className="font-medium">Login URL</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate text-primary">{result.loginUrl}</code>
              <Button variant="ghost" size="icon" onClick={() => void navigator.clipboard.writeText(result.loginUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ul className="mt-4 space-y-1 text-left text-xs text-muted-foreground">
            <li>✓ Company created</li>
            <li>✓ Default branch configured</li>
            <li>✓ Subscription started</li>
            <li>✓ Invite admin at {form.admin_email || "—"}</li>
          </ul>
          <Button asChild className="mt-6 w-full rounded-lg">
            <Link to="/admin" search={{ section: "companies" }}>View companies</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/admin" search={{ section: "companies" }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to companies
      </Link>
      <AdminPageHeader title="Create company" description={`Step ${step + 1} of 5 · ${STEPS[step]}`} />

      <ol className="mb-6 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
            <p className={cn("mt-1 truncate text-[10px] font-medium", i <= step ? "text-foreground" : "text-muted-foreground")}>{s}</p>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        {step === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" value={form.name} onChange={handleNameChange} placeholder="Platinum Courier" />
            <Field label="Registration number" value={form.registration_number} onChange={(v) => set({ registration_number: v })} placeholder="120210004567" />
            <Field label="Country code" value={form.country_code} onChange={(v) => set({ country_code: v.toUpperCase() })} placeholder="ZM" />
            <Field label="Currency" value={form.currency_code} onChange={(v) => set({ currency_code: v.toUpperCase() })} placeholder="ZMW" />
            <Field label="Phone" value={form.phone} onChange={(v) => set({ phone: v })} placeholder="+260 211 234 500" />
            <Field label="Email" value={form.email} onChange={(v) => set({ email: v })} placeholder="hello@company.com" />
            <Field label="Website" value={form.website} onChange={(v) => set({ website: v })} placeholder="https://company.com" className="sm:col-span-2" />
          </div>
        ) : null}
        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid h-24 w-24 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">Upload logo</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary color" value={form.primary_color} onChange={(v) => set({ primary_color: v })} />
              <Field label="Secondary color" value={form.secondary_color} onChange={(v) => set({ secondary_color: v })} />
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subdomain" value={form.subdomain} onChange={(v) => set({ subdomain: v })} placeholder="platinum.parcelos.africa" />
            <Field label="Company slug" value={form.slug} onChange={(v) => set({ slug: slugify(v) })} placeholder="platinum-courier" />
            <Field label="Default language" value={form.default_language} onChange={(v) => set({ default_language: v })} placeholder="English" />
            <Field label="Timezone" value={form.timezone} onChange={(v) => set({ timezone: v })} placeholder="Africa/Lusaka" />
          </div>
        ) : null}
        {step === 3 ? (
          <div className="space-y-4">
            <Select value={form.plan_code} onValueChange={(v) => set({ plan_code: v })}>
              <SelectTrigger className="h-11 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["starter", "professional", "enterprise", "custom"].map((p) => (
                  <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={form.trial_enabled} onCheckedChange={(v) => set({ trial_enabled: v })} id="trial" />
              <Label htmlFor="trial">14-day trial</Label>
            </div>
            <Field label="Trial days" value={String(form.trial_days)} onChange={(v) => set({ trial_days: Number(v) || 14 })} />
          </div>
        ) : null}
        {step === 4 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" value={form.admin_full_name} onChange={(v) => set({ admin_full_name: v })} placeholder="Admin name" />
            <Field label="Phone" value={form.admin_phone} onChange={(v) => set({ admin_phone: v })} placeholder="+260 977 000 000" />
            <Field label="Email" value={form.admin_email} onChange={(v) => set({ admin_email: v })} placeholder="admin@company.com" className="sm:col-span-2" />
          </div>
        ) : null}

        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Continue <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          ) : (
            <Button onClick={() => void handleSubmit()} disabled={createCompany.isPending}>
              {createCompany.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Generate workspace
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 rounded-lg" />
    </div>
  );
}
