import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Loader2, Share2 } from "lucide-react";
import { SharePortalPanel } from "@/components/dashboard/share-portal-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { updateCompanyBrand, uploadCompanyLogo } from "@/lib/api/company-brand";
import { toast } from "sonner";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({ meta: [{ title: "Set up your brand — ParcelOS" }] }),
  component: BrandOnboardingPage,
});

function BrandOnboardingPage() {
  const { companyId } = useAuth();
  const { tenant, updateTenant, refreshTenant } = useTenant();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(tenant.name);
  const [tagline, setTagline] = useState(tenant.tagline);
  const [primary, setPrimary] = useState(tenant.primaryColor);
  const [accent, setAccent] = useState(tenant.accentColor);
  const [phone, setPhone] = useState(tenant.supportPhone);
  const [email, setEmail] = useState(tenant.supportEmail);
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logoUrl);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(Boolean(tenant.logoUrl));

  const companyKey = companyId || tenant.id;

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    const result = await uploadCompanyLogo(companyKey, file);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setLogoUrl(result.url);
    updateTenant({ logoUrl: result.url });
    toast.success("Logo uploaded");
  };

  const onSave = async () => {
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

    updateTenant({
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

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">First-time setup</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Create your company brand</h1>
        <p className="mt-2 text-muted-foreground">
          Customers only see your name, logo and colours. After this you can share your portal link or QR code.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            )}
          </button>
          <div>
            <p className="font-medium">Company logo</p>
            <p className="text-sm text-muted-foreground">Used on the portal and as the installable app icon.</p>
            <Button type="button" variant="outline" size="sm" className="mt-2 rounded-xl" onClick={() => fileRef.current?.click()}>
              Upload logo
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
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tagline</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} className="h-11 rounded-xl" />
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
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Support email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>

        <Button className="h-12 w-full rounded-xl" disabled={saving} onClick={() => void onSave()}>
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
