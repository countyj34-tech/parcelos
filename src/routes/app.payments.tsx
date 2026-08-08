import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Banknote, CreditCard, Smartphone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { PAYMENTS, money } from "@/lib/mock-data";

export const Route = createFileRoute("/app/payments")({
  head: () => ({
    meta: [
      { title: "Payments — ParcelOS" },
      { name: "description", content: "Mobile money, card and cash payments reconciled per branch and shift." },
      { property: "og:title", content: "Payments — ParcelOS" },
      { property: "og:description", content: "Reconcile mobile money, card and cash." },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  return (
    <div>
      <PageHeader
        title="Payments"
        description="Wednesday, 12 March 2026 · all branches"
        actions={
          <Button variant="outline" className="rounded-full">
            <Download className="mr-1.5 h-4 w-4" /> Cash-up sheet
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Collected today" value={money(88420)} delta={6.8} icon={Banknote} />
        <KpiCard label="Mobile money" value={money(61240)} delta={9.1} hint="69% of volume" icon={Smartphone} />
        <KpiCard label="Card" value={money(14180)} delta={-2.4} icon={CreditCard} />
        <KpiCard label="Cash on hand" value={money(13000)} hint="4 branches unbanked" icon={Wallet} />
      </div>

      <div className="card-elevated mt-5 overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PAYMENTS.map((p) => (
              <TableRow key={p.ref}>
                <TableCell className="font-medium">{p.ref}</TableCell>
                <TableCell>{p.customer}</TableCell>
                <TableCell className="text-muted-foreground">{p.method}</TableCell>
                <TableCell>{money(p.amount)}</TableCell>
                <TableCell className="text-muted-foreground">{p.time}</TableCell>
                <TableCell>
                  <StatusPill status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
