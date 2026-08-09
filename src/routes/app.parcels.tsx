import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Filter, Loader2, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { ParcelDetailSheet } from "@/components/dashboard/parcel-detail-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/hooks/use-auth";
import { useBranchNames, useParcels } from "@/hooks/use-parcels";
import { PARCEL_FLOW, type Parcel } from "@/lib/types/parcel";
import { money } from "@/lib/money";

export const Route = createFileRoute("/app/parcels")({
  head: () => ({ meta: [{ title: "Parcels — ParcelOS" }] }),
  component: ParcelsPage,
});

function ParcelsPage() {
  const { companyId } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [branch, setBranch] = useState("all");
  const [payment, setPayment] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Parcel | null>(null);
  const { data: branches = [] } = useBranchNames(companyId);

  const { data: rows = [], isLoading, isFetching } = useParcels({
    search: query || undefined,
    status: status === "all" ? undefined : status,
    branch: branch === "all" ? undefined : branch,
    payment: payment === "all" ? undefined : payment,
  });

  return (
    <div>
      <PageHeader
        title="Parcels"
        description={`${rows.length} parcels${isFetching ? " · syncing…" : ""}`}
        actions={
          <>
            <Button variant="outline" className="rounded-xl" disabled>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/app/reception/register">
                <Plus className="mr-2 h-4 w-4" /> Register
              </Link>
            </Button>
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tracking, sender, receiver…"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 w-[150px] rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {PARCEL_FLOW.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="h-10 w-[180px] rounded-xl">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={payment} onValueChange={setPayment}>
            <SelectTrigger className="h-10 w-[130px] rounded-xl">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {["Paid", "Unpaid", "Cash on Collection"].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-10 rounded-xl" disabled>
            <Filter className="mr-1.5 h-3.5 w-3.5" /> More
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading parcels…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No parcels yet. Register a walk-in or share your customer portal link.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10" />
                  <TableHead>Tracking</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.tracking} className="cursor-pointer" onClick={() => setDetail(p)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(p.tracking)}
                        onCheckedChange={(c) =>
                          setSelected((s) => (c ? [...s, p.tracking] : s.filter((t) => t !== p.tracking)))
                        }
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">{p.tracking}</TableCell>
                    <TableCell>{p.sender}</TableCell>
                    <TableCell>{p.receiver}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground">
                      {p.origin} → {p.destination}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={p.status} />
                    </TableCell>
                    <TableCell>
                      <StatusPill status={p.payment} />
                    </TableCell>
                    <TableCell className="text-right font-medium">{money(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ParcelDetailSheet parcel={detail} open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}
