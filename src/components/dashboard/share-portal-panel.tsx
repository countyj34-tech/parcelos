import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, MessageCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { copyToClipboard } from "@/lib/clipboard";
import {
  getCustomerPortalUrl,
  getPublicAppOrigin,
  getWhatsAppShareUrl,
  isPublicShareOrigin,
  resolveCustomerPortalSlug,
  type TenantBranding,
} from "@/lib/tenant";
import { toast } from "sonner";

function shareTenant(
  tenant: TenantBranding,
  companyName: string | undefined,
  companySlug: string | null | undefined,
): TenantBranding {
  const name =
    tenant.name && tenant.name !== "Swift Logistics" ? tenant.name : companyName || tenant.name;
  const slug =
    resolveCustomerPortalSlug({
      slug: companySlug || tenant.slug,
      name: name || companyName,
    }) || tenant.slug;
  const domain =
    tenant.domain && !tenant.domain.startsWith("swiftlogistics.")
      ? tenant.domain
      : `${slug}.parcelos.africa`;
  return {
    ...tenant,
    name: name || tenant.name,
    slug,
    domain,
    logoInitials:
      (name || tenant.name)
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || tenant.logoInitials,
  };
}

export function SharePortalPanel({ compact }: { compact?: boolean }) {
  const { tenant, refreshTenant } = useTenant();
  const { company, profile, companyId } = useAuth();
  const share = shareTenant(tenant, company || profile?.companyName, profile?.companySlug);
  const [portalUrl, setPortalUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const publicOrigin = getPublicAppOrigin();
  const linkIsPublic = Boolean(publicOrigin && isPublicShareOrigin(publicOrigin));

  useEffect(() => {
    if (companyId) void refreshTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    const url = getCustomerPortalUrl(share);
    setPortalUrl(url);
    if (!url.startsWith("http")) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: "#0F172A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }).then((data) => {
      if (!cancelled) setQrDataUrl(data);
    });
    return () => {
      cancelled = true;
    };
  }, [share.slug, share.name, share.domain]);

  const copyLink = async () => {
    if (!linkIsPublic) {
      toast.error("Set VITE_APP_URL to your live HTTPS site first — localhost links do not work for customers");
      return;
    }
    const ok = await copyToClipboard(portalUrl);
    if (ok) {
      setCopied(true);
      toast.success("Portal link copied — send it to customers");
      window.setTimeout(() => setCopied(false), 2000);
      return;
    }
    // Last resort: select the input so user can Ctrl+C
    const input = document.querySelector<HTMLInputElement>("[data-portal-link-input]");
    if (input) {
      input.focus();
      input.select();
      toast.message("Press Ctrl+C (or Cmd+C) to copy the selected link");
      return;
    }
    toast.error("Could not copy automatically — long-press the link and copy it");
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${share.slug}-portal-qr.png`;
    a.click();
    toast.success("QR code downloaded");
  };

  return (
    <div className={compact ? "space-y-4" : "grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]"}>
      <div className="space-y-5">
        {!compact ? (
          <div>
            <h3 className="text-base font-semibold">Your customer website</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              One permanent link for {share.name}. Unlimited people can open it — guests or signed-in
              customers — to send and track parcels. Share it as a website, WhatsApp, or QR; it stays the
              same as long as your company slug does.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>{share.name} — public website link</Label>
          {!linkIsPublic ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              Customer links must use your <strong>live</strong> site — not localhost.
              Set <span className="font-mono">VITE_APP_URL=https://your-site.netlify.app</span> in{" "}
              <span className="font-mono">.env</span>, then restart the dev server. On Netlify, set the same
              env var in Site settings.
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              data-portal-link-input
              value={linkIsPublic ? portalUrl : `(set VITE_APP_URL) …/c/${share.slug}`}
              onFocus={(e) => e.currentTarget.select()}
              className="h-11 rounded-xl font-mono text-xs sm:text-sm"
            />
            <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl" onClick={() => void copyLink()}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Includes your company name in the path:{" "}
            <span className="font-mono text-foreground">/c/{share.slug}</span>
            {" · "}
            Anyone with the link can use it (no one-time lock).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="rounded-xl" onClick={() => void copyLink()}>
            <Copy className="mr-1.5 h-4 w-4" /> Copy website link
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" asChild disabled={!linkIsPublic}>
            <a
              href={linkIsPublic ? getWhatsAppShareUrl(share, portalUrl) : undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!linkIsPublic) {
                  e.preventDefault();
                  toast.error("Set VITE_APP_URL to your live HTTPS site first");
                }
              }}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" /> Share on WhatsApp
            </a>
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" asChild disabled={!linkIsPublic}>
            <a
              href={linkIsPublic ? portalUrl : undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!linkIsPublic) {
                  e.preventDefault();
                  toast.error("Set VITE_APP_URL to your live HTTPS site first");
                }
              }}
            >
              <ExternalLink className="mr-1.5 h-4 w-4" /> Open as website
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={downloadQr}
            disabled={!qrDataUrl || !linkIsPublic}
          >
            <Download className="mr-1.5 h-4 w-4" /> Download QR
          </Button>
        </div>

        {!compact ? (
          <ol className="list-decimal space-y-2 rounded-2xl border border-border bg-muted/30 p-4 pl-8 text-sm text-muted-foreground">
            <li>
              This is your online customer site — paste it on Facebook, WhatsApp status, or print the QR at the
              counter.
            </li>
            <li>Many customers can use the same link at once; each person sends and tracks their own parcels.</li>
            <li>Optional: they can Install / Add to Home Screen for an app-like icon with your logo.</li>
          </ol>
        ) : null}
      </div>

      <div className="mx-auto flex w-full max-w-[220px] flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <QrCode className="h-3.5 w-3.5" /> Portal QR
        </div>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`${share.name} portal QR code`} className="h-48 w-48 rounded-xl bg-white" />
        ) : (
          <div className="grid h-48 w-48 place-items-center rounded-xl bg-muted text-xs text-muted-foreground">
            Generating…
          </div>
        )}
        <p className="text-xs text-muted-foreground">Print for the counter or save to your phone.</p>
      </div>
    </div>
  );
}
