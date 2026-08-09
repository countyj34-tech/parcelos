import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { SharePortalPanel } from "@/components/dashboard/share-portal-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { updateCompanyBrand, uploadCompanyLogo } from "@/lib/api/company-brand";
import { fetchMessagingSettings, updateMessagingSettings } from "@/lib/api/company-admin";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ParcelOS" },
      { name: "description", content: "Company profile, branding, SMS and WhatsApp settings, API keys and security." },
      { property: "og:title", content: "Settings — ParcelOS" },
      { property: "og:description", content: "Workspace configuration for your courier company." },
    ],
  }),
  component: SettingsPage,
});

function BrandingEditor() {
  const { companyId } = useAuth();
  const { tenant, updateTenant, refreshTenant } = useTenant();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(tenant.name);
  const [tagline, setTagline] = useState(tenant.tagline);
  const [primary, setPrimary] = useState(tenant.primaryColor);
  const [accent, setAccent] = useState(tenant.accentColor);
  const [phone, setPhone] = useState(tenant.supportPhone);
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl);
  const [saving, setSaving] = useState(false);

  const companyKey = companyId || tenant.id;

  return (
    <div>
      <p className="mb-6 text-sm text-muted-foreground">
        These settings appear on your customer portal and as the installable app icon. Customers only see your brand.
      </p>
      <div className="flex flex-wrap items-start gap-8">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Company logo</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">Logo</span>
            )}
          </button>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-full"
            onClick={() => fileRef.current?.click()}
          >
            Upload logo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const result = await uploadCompanyLogo(companyKey, file);
              if ("error" in result) {
                toast.error(result.error);
                return;
              }
              setLogoUrl(result.url);
              updateTenant({ logoUrl: result.url });
              toast.success("Logo uploaded");
            }}
          />
        </div>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Tagline</Label>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Primary colour</Label>
          <Input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-11 rounded-xl p-1" />
        </div>
        <div className="space-y-2">
          <Label>Accent colour</Label>
          <Input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-11 rounded-xl p-1" />
        </div>
        <div className="space-y-2">
          <Label>Support phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" />
        </div>
      </div>
      <Button
        className="mt-6 rounded-full"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          const result = await updateCompanyBrand({
            companyId: companyKey,
            name,
            tagline,
            primaryColor: primary,
            accentColor: accent,
            supportPhone: phone,
            logoUrl,
          });
          setSaving(false);
          if (!result.ok) {
            toast.error(result.error ?? "Save failed");
            return;
          }
          updateTenant({
            name,
            tagline,
            primaryColor: primary,
            accentColor: accent,
            supportPhone: phone,
            logoUrl,
          });
          await refreshTenant();
          toast.success("Branding saved");
        }}
      >
        Save branding
      </Button>
    </div>
  );
}

function MessagingSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [notifyOnReceive, setNotifyOnReceive] = useState(true);
  const [notifyOnDispatch, setNotifyOnDispatch] = useState(true);
  const [notifyOnReady, setNotifyOnReady] = useState(true);
  const [smsSenderId, setSmsSenderId] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  useEffect(() => {
    void fetchMessagingSettings()
      .then((s) => {
        if (!s) return;
        setSmsEnabled(s.smsEnabled);
        setWhatsappEnabled(s.whatsappEnabled);
        setNotifyOnReceive(s.notifyOnReceive);
        setNotifyOnDispatch(s.notifyOnDispatch);
        setNotifyOnReady(s.notifyOnReady);
        setSmsSenderId(s.smsSenderId);
        setWhatsappNumber(s.whatsappNumber);
      })
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await updateMessagingSettings({
        smsEnabled,
        whatsappEnabled,
        smsSenderId,
        whatsappNumber,
        notifyOnReceive,
        notifyOnDispatch,
        notifyOnReady,
      });
      toast.success("Messaging settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading messaging…
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Customer alerts go through Africa&apos;s Talking or Twilio (set secrets on Supabase Edge Functions).
        Without keys, messages are logged for ops visibility.
      </p>
      <div className="divide-y divide-border">
        {(
          [
            ["SMS channel", "Send text updates to sender/receiver phones", smsEnabled, setSmsEnabled],
            ["WhatsApp channel", "Use WhatsApp Business via Twilio when available", whatsappEnabled, setWhatsappEnabled],
            ["On parcel received", "Notify at intake / counter registration", notifyOnReceive, setNotifyOnReceive],
            ["On dispatch", "Notify when handed to a driver", notifyOnDispatch, setNotifyOnDispatch],
            ["On ready for collection", "Notify when parcel arrives at destination", notifyOnReady, setNotifyOnReady],
          ] as const
        ).map(([title, desc, on, setOn]) => (
          <div key={title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <Switch checked={on} onCheckedChange={setOn} />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>SMS sender ID</Label>
          <Input
            value={smsSenderId}
            onChange={(e) => setSmsSenderId(e.target.value)}
            placeholder="e.g. PARCELOS"
            className="h-11 rounded-xl"
            maxLength={11}
          />
        </div>
        <div className="space-y-2">
          <Label>WhatsApp business number</Label>
          <Input
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+260…"
            className="h-11 rounded-xl"
          />
        </div>
      </div>
      <Button className="mt-6 rounded-full" disabled={saving} onClick={() => void onSave()}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save messaging
      </Button>
    </div>
  );
}

function PriceChartUploader() {
  const { tenant, updateTenant } = useTenant();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image (JPG, PNG, or SVG)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4MB");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(file);
      });
      updateTenant({ priceChartUrl: dataUrl });
      toast.success("Price chart uploaded — visible on customer portal");
    } catch {
      toast.error("Could not upload chart");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
          {tenant.priceChartUrl ? (
            <img
              src={tenant.priceChartUrl}
              alt={`${tenant.name} price chart`}
              className="max-h-[420px] w-full object-contain object-top"
            />
          ) : (
            <div className="grid h-56 place-items-center px-6 text-center text-sm text-muted-foreground">
              <div>
                <ImagePlus className="mx-auto mb-2 h-8 w-8 opacity-50" />
                No price chart yet. Upload the sheet you display at the counter.
              </div>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-xl"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {tenant.priceChartUrl ? "Replace chart" : "Upload chart"}
          </Button>
          {tenant.priceChartUrl ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                updateTenant({ priceChartUrl: null });
                toast.message("Price chart removed from portal");
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Remove
            </Button>
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How customers see this</p>
        <ul className="mt-3 list-disc space-y-2 pl-4">
          <li>Shown on the send-parcel flow as “View rates”.</li>
          <li>Ranges only — fee is confirmed at drop-off after weighing.</li>
          <li>Use a clear photo or scan of your printed counter chart.</li>
        </ul>
      </div>
    </div>
  );
}

function SettingsPage() {
  const { tenant } = useTenant();

  return (
    <div>
      <PageHeader title="Settings" description={`${tenant.name} workspace configuration`} />
      <Tabs defaultValue="launch">
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
          <TabsTrigger value="launch">Launch & share</TabsTrigger>
          <TabsTrigger value="profile">Company</TabsTrigger>
          <TabsTrigger value="branding">Logo & theme</TabsTrigger>
          <TabsTrigger value="operations">Branches & hours</TabsTrigger>
          <TabsTrigger value="pricing">Categories & rates</TabsTrigger>
          <TabsTrigger value="messaging">SMS & WhatsApp</TabsTrigger>
          <TabsTrigger value="receipts">Receipts & printers</TabsTrigger>
        </TabsList>

        <TabsContent value="launch" className="card-elevated mt-5 p-6">
          <SharePortalPanel />
        </TabsContent>

        <TabsContent value="profile" className="card-elevated mt-5 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ["Company name", "Swift Logistics Limited"],
              ["Trading name", "Swift Logistics"],
              ["Head office", "Cairo Road, Lusaka, Zambia"],
              ["Registration number", "120210004567"],
              ["TPIN", "1002938475"],
              ["Support phone", "+260 211 234 500"],
            ].map(([l, v]) => (
              <div key={l} className="space-y-2">
                <Label>{l}</Label>
                <Input defaultValue={v} className="h-11 rounded-xl" />
              </div>
            ))}
          </div>
          <Button className="mt-6 rounded-full">Save company profile</Button>
        </TabsContent>

        <TabsContent value="branding" className="card-elevated mt-5 p-6">
          <BrandingEditor />
        </TabsContent>

        <TabsContent value="messaging" className="card-elevated mt-5 p-6">
          <MessagingSettingsPanel />
        </TabsContent>

        <TabsContent value="operations" className="card-elevated mt-5 p-6">
          <p className="text-sm text-muted-foreground">Manage branch locations and business hours.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Default opening</Label><Input defaultValue="07:30" className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>Default closing</Label><Input defaultValue="18:00" className="h-11 rounded-xl" /></div>
          </div>
          <Button className="mt-6 rounded-xl">Manage branches</Button>
        </TabsContent>

        <TabsContent value="pricing" className="card-elevated mt-5 space-y-6 p-6">
          <div>
            <h3 className="text-base font-semibold">Counter price chart</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload the same rate sheet customers see at your branch. Portal users can open it for fee ranges —
              the final amount is still confirmed when staff weigh the parcel at drop-off.
            </p>
          </div>

          <PriceChartUploader />

          <div className="border-t border-border pt-6">
            <h3 className="text-base font-semibold">Categories &amp; zones</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Structured rates can be added later. For now the uploaded chart is the customer-facing reference.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-xl" disabled>
                Edit categories (coming soon)
              </Button>
              <Button variant="outline" className="rounded-xl" disabled>
                Edit zone rates (coming soon)
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="receipts" className="card-elevated mt-5 p-6">
          <div className="space-y-4">
            <div className="space-y-2"><Label>Receipt header</Label><Input defaultValue="Swift Logistics" className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>Default printer</Label><Input defaultValue="Counter thermal · EPSON TM-T88" className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>Label printer</Label><Input defaultValue="Zebra ZD421" className="h-11 rounded-xl" /></div>
          </div>
          <Button className="mt-6 rounded-xl">Save printer settings</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
