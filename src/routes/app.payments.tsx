import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CreditCard, Download, Loader2, Smartphone, Wallet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { useCompanyPayments } from "@/hooks/use-parcels";
import { money } from "@/lib/money";

export const Route = createFileRoute("/app/payments")({
  head: () => ({
    meta: [
      { title: "Payments — ParcelOS" },
      { name: "description", content: "Mobile money, card and cash payments reconciled per branch and shift." },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { data, isLoading } = useCompanyPayments();
  const rows = data?.rows ?? [];
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        title="Payments"
        description={`${today} · live`}
        actions={
          <Button variant="outline" className="rounded-full" disabled>
            <Download className="mr-1.5 h-4 w-4" /> Cash-up sheet
          </Button>
        }
      />

      {isLoading ? (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading payments…
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Collected today" value={money(data?.todayTotal ?? 0)} icon={Banknote} />
        <KpiCard label="Mobile money" value={money(data?.mobileMoney ?? 0)} icon={Smartphone} />
        <KpiCard label="Card" value={money(data?.card ?? 0)} icon={CreditCard} />
        <KpiCard label="Cash" value={money(data?.cash ?? 0)} icon={Wallet} />
      </div>

      <div className="card-elevated mt-5 overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No payments yet. Reception payments appear here instantly.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.ref}</TableCell>
                  <TableCell>{p.customer}</TableCell>
                  <TableCell className="text-muted-foreground">{p.tracking ?? "—"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.method}</TableCell>
                  <TableCell>{money(p.amount, p.currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.time}</TableCell>
                  <TableCell>
                    <StatusPill status={p.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
