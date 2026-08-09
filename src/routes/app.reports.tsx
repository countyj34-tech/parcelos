import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Loader2, Banknote, Clock, Package, Truck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { useCompanyDashboard, useCompanyPayments, useParcels } from "@/hooks/use-parcels";
import { downloadExcelCsv, printReportPdf } from "@/lib/export-report";
import { money } from "@/lib/money";
import { useTenant } from "@/hooks/use-tenant";
import { toast } from "sonner";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: "Reports — ParcelOS" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { tenant } = useTenant();
  const { data: dash, isLoading } = useCompanyDashboard();
  const { data: payments } = useCompanyPayments();
  const { data: parcels = [] } = useParcels({});

  const exportExcel = () => {
    const rows = [
      ...parcels.map((p) => ({
        Tracking: p.tracking,
        Sender: p.sender,
        Receiver: p.receiver,
        Origin: p.origin,
        Destination: p.destination,
        Status: p.status,
        Payment: p.payment,
        Amount: p.amount,
        Created: p.created,
      })),
    ];
    if (!rows.length) {
      toast.message("No parcels to export yet");
      return;
    }
    downloadExcelCsv(`${tenant.slug || "company"}-parcels-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("Excel/CSV downloaded");
  };

  const exportPaymentsExcel = () => {
    const rows = (payments?.rows ?? []).map((p) => ({
      Reference: p.ref,
      Customer: p.customer,
      Tracking: p.tracking ?? "",
      Method: p.method,
      Amount: p.amount,
      Currency: p.currency,
      Status: p.status,
      Time: p.time,
    }));
    if (!rows.length) {
      toast.message("No payments to export yet");
      return;
    }
    downloadExcelCsv(`${tenant.slug || "company"}-payments-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("Payments CSV downloaded");
  };

  const exportPdf = () => {
    const kpis = `
      <div class="kpi">
        <div><span>Today's revenue</span><strong>${dash?.revenueToday ?? money(0)}</strong></div>
        <div><span>Today's parcels</span><strong>${dash?.todayParcels ?? 0}</strong></div>
        <div><span>In transit</span><strong>${dash?.inTransit ?? 0}</strong></div>
        <div><span>Waiting drop-off</span><strong>${dash?.waitingDropOff ?? 0}</strong></div>
        <div><span>Ready for collection</span><strong>${dash?.readyCollection ?? 0}</strong></div>
        <div><span>Payments today</span><strong>${money(payments?.todayTotal ?? 0)}</strong></div>
      </div>
      <h2 style="font-size:16px;margin:0 0 8px">Recent parcels</h2>
      <table>
        <thead><tr><th>Tracking</th><th>Route</th><th>Status</th><th>Payment</th><th>Amount</th></tr></thead>
        <tbody>
          ${parcels
            .slice(0, 40)
            .map(
              (p) =>
                `<tr><td>${p.tracking}</td><td>${p.origin} → ${p.destination}</td><td>${p.status}</td><td>${p.payment}</td><td>${money(p.amount)}</td></tr>`,
            )
            .join("") || `<tr><td colspan="5">No parcels yet</td></tr>`}
        </tbody>
      </table>`;
    printReportPdf(`${tenant.name} — Operations report`, kpis);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Live operational snapshot for your company"
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={exportPdf}>
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={exportExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export parcels
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={exportPaymentsExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export payments
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Today's revenue" value={dash?.revenueToday ?? money(0)} icon={Banknote} />
        <StatCard label="Today's parcels" value={dash?.todayParcels ?? 0} icon={Package} />
        <StatCard label="In transit" value={dash?.inTransit ?? 0} icon={Truck} />
        <StatCard label="Waiting drop-off" value={dash?.waitingDropOff ?? 0} icon={Clock} />
        <StatCard label="Ready for collection" value={dash?.readyCollection ?? 0} icon={Package} />
        <StatCard label="Payments today" value={money(payments?.todayTotal ?? 0)} icon={Banknote} />
      </div>

      <p className="text-sm text-muted-foreground">
        PDF opens a print window (Save as PDF). Excel downloads are CSV files that open in Excel or Google Sheets.
      </p>
    </div>
  );
}
