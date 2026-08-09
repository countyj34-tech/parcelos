import { money } from "@/lib/money";
import type { Parcel } from "@/lib/types/parcel";
import type { TenantBranding } from "@/lib/tenant";

type ReceiptPrintProps = {
  tenant: TenantBranding;
  parcel: Parcel;
  fee: number;
  methodLabel: string;
  copies?: number;
};

/** Opens a print window with N identical thermal-style receipts. */
export function printParcelReceipts({
  tenant,
  parcel,
  fee,
  methodLabel,
  copies = 3,
}: ReceiptPrintProps) {
  const when = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const copyLabels = ["CUSTOMER COPY", "COUNTER COPY", "ARCHIVE COPY"];
  const blocks = Array.from({ length: copies }, (_, i) => {
    const label = copyLabels[i] ?? `COPY ${i + 1}`;
    return `
      <section class="receipt">
        <header>
          ${tenant.logoUrl ? `<img src="${tenant.logoUrl}" alt="" class="logo" />` : ""}
          <h1>${escapeHtml(tenant.name)}</h1>
          <p class="muted">${escapeHtml(tenant.tagline || "Courier receipt")}</p>
          <p class="copy">${label}</p>
        </header>
        <dl>
          <div><dt>Tracking</dt><dd>${escapeHtml(parcel.tracking)}</dd></div>
          <div><dt>Date</dt><dd>${escapeHtml(when)}</dd></div>
          <div><dt>Sender</dt><dd>${escapeHtml(parcel.sender)} · ${escapeHtml(parcel.senderPhone)}</dd></div>
          <div><dt>Receiver</dt><dd>${escapeHtml(parcel.receiver)} · ${escapeHtml(parcel.receiverPhone)}</dd></div>
          <div><dt>Route</dt><dd>${escapeHtml(parcel.origin)} → ${escapeHtml(parcel.destination)}</dd></div>
          <div><dt>Payment</dt><dd>${escapeHtml(methodLabel)}</dd></div>
        </dl>
        <p class="total">Amount paid<br/><strong>${escapeHtml(money(fee))}</strong></p>
        <p class="muted foot">Thank you for choosing ${escapeHtml(tenant.name)}</p>
      </section>
    `;
  }).join('<div class="cut"></div>');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Receipts — ${escapeHtml(parcel.tracking)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: ui-monospace, Menlo, Consolas, monospace; color: #111; }
  .receipt { padding: 8px 4px 24px; }
  .logo { width: 48px; height: 48px; object-fit: contain; display: block; margin: 0 auto 6px; }
  h1 { font-size: 14px; text-align: center; margin: 0; }
  .muted { color: #555; font-size: 10px; text-align: center; margin: 4px 0; }
  .copy { font-weight: 700; letter-spacing: 0.08em; font-size: 11px; text-align: center; margin: 8px 0; }
  dl { margin: 10px 0; }
  dl div { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin: 4px 0; }
  dt { color: #555; }
  dd { margin: 0; text-align: right; font-weight: 600; max-width: 60%; }
  .total { text-align: center; margin: 14px 0 8px; font-size: 12px; }
  .total strong { font-size: 18px; }
  .foot { margin-top: 12px; }
  .cut { border-top: 1px dashed #999; margin: 8px 0 16px; page-break-after: always; }
  @media print { .cut { page-break-after: always; } }
</style></head><body>${blocks}
<script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
