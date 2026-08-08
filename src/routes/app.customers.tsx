import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, UserRound } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/status-pill";
import { CUSTOMERS, PARCELS, money } from "@/lib/mock-data";

export const Route = createFileRoute("/app/customers")({
  head: () => ({ meta: [{ title: "Customers — ParcelOS" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(CUSTOMERS[0]!);

  const rows = CUSTOMERS.filter(
    (c) =>
      query === "" ||
      [c.name, c.phone, c.email].join(" ").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Customers" description={`${rows.length} customers`} />

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or phone…" className="h-11 rounded-xl pl-9" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Parcels</TableHead>
                <TableHead>Last parcel</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.phone} className="cursor-pointer" onClick={() => setSelected(c)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                  <TableCell>{c.parcels}</TableCell>
                  <TableCell className="text-muted-foreground">{c.since}</TableCell>
                  <TableCell><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <p className="text-sm text-muted-foreground">{selected.phone}</p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted-foreground">Total parcels</dt><dd className="text-xl font-bold">{selected.parcels}</dd></div>
            <div><dt className="text-muted-foreground">Total spend</dt><dd className="text-xl font-bold">{money(selected.spend)}</dd></div>
          </dl>

          <Tabs defaultValue="history" className="mt-6">
            <TabsList className="w-full">
              <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
              <TabsTrigger value="receivers" className="flex-1">Receivers</TabsTrigger>
              <TabsTrigger value="payments" className="flex-1">Payments</TabsTrigger>
            </TabsList>
            <TabsContent value="history" className="mt-4 space-y-2">
              {PARCELS.slice(0, 3).map((p) => (
                <div key={p.tracking} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div><p className="text-sm font-medium">{p.tracking}</p><p className="text-xs text-muted-foreground">{p.destination}</p></div>
                  <StatusPill status={p.status} />
                </div>
              ))}
            </TabsContent>
            <TabsContent value="receivers" className="mt-4 text-sm text-muted-foreground">No saved receivers yet.</TabsContent>
            <TabsContent value="payments" className="mt-4 text-sm text-muted-foreground">Payment history will appear here.</TabsContent>
          </Tabs>

          <Button className="mt-4 w-full rounded-xl">View full profile</Button>
        </div>
      </div>
    </div>
  );
}
