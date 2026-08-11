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

function BrandOnboardingPage() {
  const { companyId, company, refreshProfileAfterAuth } = useAuth();
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
  const localLogoRef = useRef<string | null>(null);

  const resolvedCompanyId = isCompanyUuid(companyId)
    ? companyId
    : isCompanyUuid(tenant.id)
      ? tenant.id
      : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await refreshProfileAfterAuth().catch(() => undefined);

      const supabase = getSupabase();
      const id = companyId;
      if (supabase && isCompanyUuid(id)) {
        const { data } = await supabase
          .from("companies")
          .select(
            "id, name, slug, code, tagline, logo_url, primary_color, secondary_color, hero_image_url, price_chart_url, support_phone, support_email, subdomain, tracking_domain, currency_code, country_code, status",
          )
          .eq("id", id)
          .maybeSingle();

        if (!cancelled && data) {
          const mapped = mapPublicCompanyToTenant(data as PublicCompanyRow);
          updateTenant(mapped);
          if (mapped.slug) await activateTenant(mapped.slug);
          setName(mapped.name);
          setTagline(mapped.tagline);
          setPrimary(mapped.primaryColor);
          setAccent(mapped.accentColor);
          setPhone(mapped.supportPhone);
          setEmail(mapped.supportEmail);
          // Don't wipe a logo the user just uploaded if the effect re-runs
          if (!localLogoRef.current) {
            setLogoUrl(mapped.logoUrl);
            setDone(Boolean(mapped.logoUrl));
          }
          setLoading(false);
          return;
        }
      }

      if (!cancelled) {
        setName(company && company !== "Swift Logistics" ? company : "");
        setTagline("");
        setPrimary("#0F766E");
        setAccent("#F59E0B");
        setPhone("");
        setEmail("");
        if (!localLogoRef.current) setLogoUrl(null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!resolvedCompanyId) {
      toast.error("Company not ready yet", {
        description: "Refresh the page or sign in again, then upload your logo.",
      });
      return;
    }

    // Instant preview while upload runs
    const preview = URL.createObjectURL(file);
    localLogoRef.current = preview;
    setLogoUrl(preview);
    setUploading(true);

    try {
      const result = await uploadCompanyLogo(resolvedCompanyId, file);
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
    if (!resolvedCompanyId) {
      toast.error("Company not ready yet — sign in again");
      return;
    }
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
      companyId: resolvedCompanyId,
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

    updateTenant({
      id: resolvedCompanyId,
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
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">First-time setup</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Create your company brand</h1>
        <p className="mt-2 text-muted-foreground">
          Customers only see your name, logo and colours. After this you can share your portal link or QR code.
        </p>
        {!resolvedCompanyId ? (
          <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Your company workspace is still linking. Refresh this page or sign out and sign in again.
          </p>
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
                  // Remote URL blocked — keep placeholder rather than broken icon
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
              placeholder="Fast. Reliable. Everywhere."
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
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" placeholder="hello@yourcompany.zm" />
          </div>
        </div>

        <Button className="h-12 w-full rounded-xl" disabled={saving || !resolvedCompanyId} onClick={() => void onSave()}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save brand &amp; continue
        </Button>
      </div>

      {done ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <Share2 className="h-4 w-4 text-primary" />
            Share {name} with customers
          </div>
          <SharePortalPanel />
          <Button className="mt-6 h-12 w-full rounded-xl" onClick={() => void navigate({ to: "/app" })}>
            Open workspace
          </Button>
        </div>
      ) : null}
    </div>
  );
}
