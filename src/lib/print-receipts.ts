import { money } from "@/lib/money";
import { printViaBluetooth } from "@/lib/thermal-bluetooth";
import type { Parcel } from "@/lib/types/parcel";
import type { TenantBranding } from "@/lib/tenant";

type ReceiptPrintProps = {
  tenant: TenantBranding;
  parcel: Parcel;
  fee: number;
  methodLabel: string;
  copies?: number;
};

function receiptLines(input: ReceiptPrintProps, copyLabel: string): string[] {
  const when = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return [
    input.tenant.name.toUpperCase(),
    input.tenant.tagline || "Courier receipt",
    copyLabel,
    "----------------",
    `Tracking: ${input.parcel.tracking}`,
    `Date: ${when}`,
    `From: ${input.parcel.sender}`,
    input.parcel.senderPhone,
    `To: ${input.parcel.receiver}`,
    input.parcel.receiverPhone,
    `${input.parcel.origin} -> ${input.parcel.destination}`,
    `Pay: ${input.methodLabel}`,
    `AMOUNT: ${money(input.fee)}`,
    "Thank you",
    "----------------",
  ];
}

function receiptHtml(input: ReceiptPrintProps) {
  const when = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const copyLabels = ["CUSTOMER COPY", "COUNTER COPY", "ARCHIVE COPY"];
  const copies = input.copies ?? 3;
  const blocks = Array.from({ length: copies }, (_, i) => {
    const label = copyLabels[i] ?? `COPY ${i + 1}`;
    return `
      <section class="receipt">
        <header>
          ${input.tenant.logoUrl ? `<img src="${escapeHtml(input.tenant.logoUrl)}" alt="" class="logo" />` : ""}
          <h1>${escapeHtml(input.tenant.name)}</h1>
          <p class="muted">${escapeHtml(input.tenant.tagline || "Courier receipt")}</p>
          <p class="copy">${label}</p>
        </header>
        <dl>
          <div><dt>Tracking</dt><dd>${escapeHtml(input.parcel.tracking)}</dd></div>
          <div><dt>Date</dt><dd>${escapeHtml(when)}</dd></div>
          <div><dt>Sender</dt><dd>${escapeHtml(input.parcel.sender)} · ${escapeHtml(input.parcel.senderPhone)}</dd></div>
          <div><dt>Receiver</dt><dd>${escapeHtml(input.parcel.receiver)} · ${escapeHtml(input.parcel.receiverPhone)}</dd></div>
          <div><dt>Route</dt><dd>${escapeHtml(input.parcel.origin)} → ${escapeHtml(input.parcel.destination)}</dd></div>
          <div><dt>Payment</dt><dd>${escapeHtml(input.methodLabel)}</dd></div>
        </dl>
        <p class="total">Amount paid<br/><strong>${escapeHtml(money(input.fee))}</strong></p>
        <p class="muted foot">Thank you for choosing ${escapeHtml(input.tenant.name)}</p>
      </section>
    `;
  }).join('<div class="cut"></div>');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Receipts — ${escapeHtml(input.parcel.tracking)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  html, body { margin: 0; }
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
</style></head><body>${blocks}</body></html>`;
}

function printViaIframe(html: string): boolean {
  if (typeof document === "undefined") return false;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const run = () => {
    try {
      win.focus();
      win.print();
    } catch (err) {
      console.warn("[printViaIframe]", err);
    }
    window.setTimeout(() => iframe.remove(), 60_000);
  };

  if (doc.readyState === "complete") {
    window.setTimeout(run, 250);
  } else {
    iframe.onload = () => window.setTimeout(run, 250);
  }
  return true;
}

/**
 * Prints thermal receipts immediately.
 * Uses a connected Bluetooth printer when the browser allows it,
 * otherwise the device print dialog (paired Bluetooth / USB / system printer).
 */
export async function printParcelReceipts(input: ReceiptPrintProps): Promise<boolean> {
  const copies = input.copies ?? 3;
  const copyLabels = ["CUSTOMER COPY", "COUNTER COPY", "ARCHIVE COPY"];
  const lines = Array.from({ length: copies }, (_, i) =>
    receiptLines(input, copyLabels[i] ?? `COPY ${i + 1}`),
  ).flat();

  try {
    const ble = await printViaBluetooth(lines);
    if (ble) return true;
  } catch (err) {
    console.warn("[printParcelReceipts bluetooth]", err);
  }

  return printViaIframe(receiptHtml(input));
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
