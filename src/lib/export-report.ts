/** Client-side report downloads — no extra dependencies. */

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h]!)).join(","))].join("\n");
}

export function downloadExcelCsv(filename: string, rows: Array<Record<string, string | number>>) {
  // Excel opens CSV reliably; BOM helps with UTF-8
  downloadTextFile(filename, `\uFEFF${toCsv(rows)}`, "text/csv;charset=utf-8");
}

export function printReportPdf(title: string, htmlBody: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Segoe UI,system-ui,sans-serif;padding:32px;color:#111}
      h1{font-size:22px;margin:0 0 8px}
      p.meta{color:#666;margin:0 0 24px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}
      th{background:#f5f5f5}
      .kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
      .kpi div{border:1px solid #e5e5e5;border-radius:10px;padding:12px}
      .kpi strong{display:block;font-size:18px;margin-top:4px}
      @media print{button{display:none}}
    </style></head><body>
    <button onclick="window.print()" style="margin-bottom:16px;padding:8px 14px">Print / Save PDF</button>
    <h1>${title}</h1>
    <p class="meta">Generated ${new Date().toLocaleString("en-GB")}</p>
    ${htmlBody}
    </body></html>`);
  w.document.close();
}
