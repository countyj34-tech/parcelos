import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, MessageCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/hooks/use-tenant";
import {
  getCustomerPortalUrl,
  getPublicPortalLabel,
  getWhatsAppShareUrl,
} from "@/lib/tenant";
import { toast } from "sonner";

export function SharePortalPanel({ compact }: { compact?: boolean }) {
  const { tenant } = useTenant();
  const [portalUrl, setPortalUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = getCustomerPortalUrl(tenant);
    setPortalUrl(url);
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
  }, [tenant]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast.success("Portal link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${tenant.slug}-portal-qr.png`;
    a.click();
    toast.success("QR code downloaded");
  };

  return (
    <div className={compact ? "space-y-4" : "grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]"}>
      <div className="space-y-5">
        {!compact ? (
          <div>
            <h3 className="text-base font-semibold">Share your customer portal</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Customers who open this link or scan the QR only see {tenant.name} — send, track, and rates for your
              company alone.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Customer link</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={portalUrl} className="h-11 rounded-xl font-mono text-xs sm:text-sm" />
            <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl" onClick={() => void copyLink()}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Public brand address: <span className="font-medium text-foreground">{getPublicPortalLabel(tenant)}</span>
            {" · "}
            Link works on this device for demos and WhatsApp sharing.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="rounded-xl" onClick={() => void copyLink()}>
            <Copy className="mr-1.5 h-4 w-4" /> Copy link
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" asChild>
            <a href={getWhatsAppShareUrl(tenant, portalUrl)} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Share on WhatsApp
            </a>
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" asChild>
            <a href={portalUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" /> Open portal
            </a>
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={downloadQr} disabled={!qrDataUrl}>
            <Download className="mr-1.5 h-4 w-4" /> Download QR
          </Button>
        </div>

        {!compact ? (
          <ol className="list-decimal space-y-2 rounded-2xl border border-border bg-muted/30 p-4 pl-8 text-sm text-muted-foreground">
            <li>Copy the link or download the QR for your counter / social posts.</li>
            <li>Customers tap or scan → your branded portal opens (not another company).</li>
            <li>Optional: they can install to the home screen when prompted.</li>
          </ol>
        ) : null}
      </div>

      <div className="mx-auto flex w-full max-w-[220px] flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <QrCode className="h-3.5 w-3.5" /> Portal QR
        </div>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`${tenant.name} portal QR code`} className="h-48 w-48 rounded-xl bg-white" />
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
