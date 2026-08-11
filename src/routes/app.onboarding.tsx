import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Loader2, Share2 } from "lucide-react";
import { SharePortalPanel } from "@/components/dashboard/share-portal-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import {
  isCompanyUuid,
  updateCompanyBrand,
  uploadCompanyLogo,
} from "@/lib/api/company-brand";
import { mapPublicCompanyToTenant, type PublicCompanyRow } from "@/lib/api/tenant";
import { getSupabase } from "@/lib/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({ meta: [{ title: "Set up your brand — ParcelOS" }] }),
  component: BrandOnboardingPage,
});

async function resolveLinkedCompanyId(
  preferred: string | null | undefined,
  opts?: { companyName?: string; fullName?: string; phone?: string },
): Promise<string | null> {
  if (isCompanyUuid(preferred)) return preferred;
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data: repaired } = await supabase.rpc("repair_my_company_link");
    if (isCompanyUuid(repaired as string)) return repaired as string;
  } catch {
    /* older DB */
  }

  const { data: existing } = await supabase.rpc("get_my_company_id");
  if (isCompanyUuid(existing as string)) return existing as string;

  // Create or claim workspace (migration 26) — also falls back to register_courier_company
  try {
    const { data: ensured, error } = await supabase.rpc("ensure_my_courier_company", {
      p_company_name: opts?.companyName?.trim() || null,
      p_phone: opts?.phone?.trim() || null,
      p_full_name: opts?.fullName?.trim() || null,
    });
    if (!error && isCompanyUuid(ensured as string)) return ensured as string;
  } catch {
    /* optional */
  }

  if (opts?.companyName?.trim()) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionEmail = sessionData.session?.user?.email ?? "";
      const { registerCourierCompany } = await import("@/lib/api/signup");
      const { companyId } = await registerCourierCompany({
        companyName: opts.companyName.trim(),
        fullName: opts.fullName?.trim() || "Owner",
        email: sessionEmail,
        phone: opts.phone,
      });
      if (isCompanyUuid(companyId)) return companyId;
    } catch (err) {
      console.warn("[resolveLinkedCompanyId] register failed", err);
    }
  }

  return null;
}

function BrandOnboardingPage() {
  const { companyId, company, profile, refreshProfileAfterAuth } = useAuth();
  const { tenant, updateTenant, refreshTenant, activateTenant } = useTenant();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [primary, setPrimary] = useState("#0F766E");
  const [accent, setAccent] = useState("#F59E0B");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkedCompanyId, setLinkedCompanyId] = useState<string | null>(
    isCompanyUuid(companyId) ? companyId : isCompanyUuid(tenant.id) ? tenant.id : null,
  );
  const localLogoRef = useRef<string | null>(null);

  const resolvedCompanyId = isCompanyUuid(linkedCompanyId)
    ? linkedCompanyId
    : isCompanyUuid(companyId)
      ? companyId
      : isCompanyUuid(tenant.id)
        ? tenant.id
        : null;

  const reloadCompany = async (id: string) => {
    const supabase = getSupabase();
    if (!supabase || !isCompanyUuid(id)) return;
    const { data } = await supabase
      .from("companies")
      .select(
        "id, name, slug, code, tagline, logo_url, primary_color, secondary_color, hero_image_url, price_chart_url, support_phone, support_email, subdomain, tracking_domain, currency_code, country_code, status",
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return;
    const mapped = mapPublicCompanyToTenant(data as PublicCompanyRow);
    updateTenant(mapped);
    if (mapped.slug) await activateTenant(mapped.slug);
    setName(mapped.name);
    setTagline(mapped.tagline);
    setPrimary(mapped.primaryColor);
    setAccent(mapped.accentColor);
    setPhone(mapped.supportPhone);
    setEmail(mapped.supportEmail);
    if (!localLogoRef.current) {
      setLogoUrl(mapped.logoUrl);
      setDone(Boolean(mapped.logoUrl && mapped.name.trim()));
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLinkError(null);
      await refreshProfileAfterAuth().catch(() => undefined);

      const id = await resolveLinkedCompanyId(companyId ?? profile?.companyId, {
        companyName:
          (typeof profile?.companyName === "string" &&
          profile.companyName !== "Your company" &&
          profile.companyName !== "Swift Logistics"
            ? profile.companyName
            : undefined) || undefined,
        fullName: profile?.fullName,
      });
      if (cancelled) return;

      if (id) {
        setLinkedCompanyId(id);
        await reloadCompany(id);
        setLoading(false);
        return;
      }

      const fallbackName =
        (company && company !== "Swift Logistics" && company !== "Your company" ? company : "") ||
        (profile?.companyName &&
        profile.companyName !== "Swift Logistics" &&
        profile.companyName !== "Your company"
          ? profile.companyName
          : "");
      setName(fallbackName);
      setTagline("");
      setPrimary("#0F766E");
      setAccent("#F59E0B");
      setPhone("");
      setEmail("");
      if (!localLogoRef.current) setLogoUrl(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, profile?.companyId]);

  const onLinkWorkspace = async () => {
    if (!name.trim()) {
      toast.error("Enter your company name first");
      return;
    }
    setLinking(true);
    setLinkError(null);
    try {
      const id = await resolveLinkedCompanyId(null, {
        companyName: name.trim(),
        fullName: profile?.fullName,
        phone,
      });
      if (!id) {
        setLinkError(
          "Could not link a company. In Supabase SQL Editor run 20260312000026_ensure_company_workspace.sql, then try again.",
        );
        toast.error("Workspace still not linked");
        return;
      }
      setLinkedCompanyId(id);
      await refreshProfileAfterAuth().catch(() => undefined);
      await reloadCompany(id);
      toast.success("Company workspace linked");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Link failed";
      setLinkError(msg);
      toast.error(msg);
    } finally {
      setLinking(false);
    }
  };

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    const companyKey = resolvedCompanyId ?? (await resolveLinkedCompanyId(companyId));
    if (!companyKey) {
      toast.error("Company not ready yet", {
        description: "Run the latest SQL migrations, then refresh or sign in again.",
      });
      return;
    }
    setLinkedCompanyId(companyKey);

    const preview = URL.createObjectURL(file);
    localLogoRef.current = preview;
    setLogoUrl(preview);
    setUploading(true);

    try {
      const result = await uploadCompanyLogo(companyKey, file);
      if ("error" in result) {
        URL.revokeObjectURL(preview);
        localLogoRef.current = null;
        setLogoUrl(null);
        toast.error(result.error);
        return;
      }
      URL.revokeObjectURL(preview);
      localLogoRef.current = result.url;
      setLogoUrl(result.url);
      updateTenant({ logoUrl: result.url });
      toast.success("Logo uploaded");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSave = async () => {
    const companyKey = resolvedCompanyId ?? (await resolveLinkedCompanyId(companyId));
    if (!companyKey) {
      toast.error("Company not ready yet — sign in again after applying SQL migration 25");
      return;
    }
    setLinkedCompanyId(companyKey);
    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!logoUrl) {
      toast.error("Upload your company logo — customers see it when they install the app");
      return;
    }

    setSaving(true);
    const result = await updateCompanyBrand({
      companyId: companyKey,
      name: name.trim(),
      tagline: tagline.trim(),
      primaryColor: primary,
      accentColor: accent,
      supportPhone: phone.trim(),
      supportEmail: email.trim(),
      logoUrl,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Could not save branding");
      return;
    }

    if (result.tenant) {
      updateTenant(result.tenant);
      if (result.tenant.slug) await activateTenant(result.tenant.slug);
    } else {
      updateTenant({
        id: companyKey,
        name: name.trim(),
        tagline: tagline.trim(),
        primaryColor: primary,
        accentColor: accent,
        supportPhone: phone.trim(),
        supportEmail: email.trim(),
        logoUrl,
        logoInitials: name
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      });
    }
    await refreshProfileAfterAuth().catch(() => undefined);
    await refreshTenant();
    setDone(true);
    toast.success("Brand saved — share your portal link or QR");
  };

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <p className="text-sm text-muted-foreground">Loading your company…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {done ? "Your brand" : "First-time setup"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          {done ? "Your company brand" : "Create your company brand"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {done
            ? "Your branding is saved. Share the portal link or QR so customers can start using it."
            : "Customers only see your name, logo and colours. After this you can share your portal link or QR code."}
        </p>
        {!resolvedCompanyId ? (
          <div className="mt-3 space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-900 dark:text-amber-100">
            <p>
              Your login is not linked to a company yet. Git push does not apply SQL — run{" "}
              <code className="rounded bg-black/10 px-1">20260312000026_ensure_company_workspace.sql</code> in
              Supabase SQL Editor, type your company name below, then click <strong>Link workspace</strong>.
            </p>
            {linkError ? <p className="text-destructive">{linkError}</p> : null}
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-amber-600/40 bg-background"
              disabled={linking || !name.trim()}
              onClick={() => void onLinkWorkspace()}
            >
              {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Link workspace
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40"
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : logoUrl ? (
              <img
                src={logoUrl}
                alt="Company logo"
                className="h-full w-full object-cover"
                onError={() => {
                  if (localLogoRef.current === logoUrl) return;
                  setLogoUrl(null);
                }}
              />
            ) : (
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            )}
          </button>
          <div>
            <p className="font-medium">Company logo</p>
            <p className="text-sm text-muted-foreground">Used on the portal and as the installable app icon.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 rounded-xl"
              disabled={!resolvedCompanyId || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => void onLogo(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Company name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="Your courier company name"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tagline</Label>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="Short line customers see on your portal"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Primary colour</Label>
            <Input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-11 rounded-xl p-1" />
          </div>
          <div className="space-y-1.5">
            <Label>Accent colour</Label>
            <Input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-11 rounded-xl p-1" />
          </div>
          <div className="space-y-1.5">
            <Label>Support phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" placeholder="+260…" />
          </div>
          <div className="space-y-1.5">
            <Label>Support email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="hello@yourcompany.zm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-12 flex-1 rounded-xl text-base"
            disabled={saving || !resolvedCompanyId}
            onClick={() => void onSave()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {done ? "Save brand changes" : "Save brand & continue"}
          </Button>
          {done ? (
            <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => void navigate({ to: "/app" })}>
              Go to dashboard
            </Button>
          ) : null}
        </div>
      </div>

      {done || logoUrl ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Share {name || "your company"} with customers</h2>
          </div>
          <SharePortalPanel />
        </div>
      ) : null}
    </div>
  );
}
