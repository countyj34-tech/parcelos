import { createFileRoute } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { PARCELS, money } from "@/lib/mock-data";

export const Route = createFileRoute("/portal/history")({
  head: () => ({
    meta: [
      { title: "Parcel history — ParcelOS customer portal" },
      { name: "description", content: "Every parcel you have sent, with status, branch and fees." },
      { property: "og:title", content: "Parcel history — ParcelOS" },
      { property: "og:description", content: "Every parcel you have sent with ParcelOS." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Parcel history</h1>
      <p className="mt-2 text-sm text-muted-foreground">42 parcels sent since March 2024.</p>

      <div className="card-elevated mt-6 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Tracking</TableHead>
                <TableHead>Receiver</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PARCELS.map((p) => (
                <TableRow key={p.tracking} className="transition-colors">
                  <TableCell className="font-medium">{p.tracking}</TableCell>
                  <TableCell>{p.receiver}</TableCell>
                  <TableCell className="text-muted-foreground">{p.destination}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{p.created}</TableCell>
                  <TableCell>{money(p.amount)}</TableCell>
                  <TableCell>
                    <StatusPill status={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
