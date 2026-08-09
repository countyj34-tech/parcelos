import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search, UserRound } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/status-pill";
import { useCompanyCustomers, useCustomerParcels } from "@/hooks/use-parcels";
import { money } from "@/lib/money";
import type { CompanyCustomer } from "@/lib/api/company-ops";

export const Route = createFileRoute("/app/customers")({
  head: () => ({ meta: [{ title: "Customers — ParcelOS" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [query, setQuery] = useState("");
  const { data: rows = [], isLoading } = useCompanyCustomers(query);
  const [selected, setSelected] = useState<CompanyCustomer | null>(null);
  const active = selected && rows.some((r) => r.id === selected.id) ? selected : rows[0] ?? null;
  const { data: history = [] } = useCustomerParcels(active?.phone ?? null);

  return (
    <div>
      <PageHeader title="Customers" description={isLoading ? "Loading…" : `${rows.length} customers`} />

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or phone…"
          className="h-11 rounded-xl pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Parcels</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No customers yet. They appear when parcels are registered.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                    <TableCell>{c.parcels}</TableCell>
                    <TableCell className="text-muted-foreground">{c.since}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {c.isGuest ? "Guest" : "Active"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          {active ? (
            <>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">{active.name}</h2>
                  <p className="text-sm text-muted-foreground">{active.phone}</p>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Total parcels</dt>
                  <dd className="text-xl font-bold">{active.parcels}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total spend</dt>
                  <dd className="text-xl font-bold">{money(active.spend)}</dd>
                </div>
              </dl>

              <Tabs defaultValue="history" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="history" className="flex-1">
                    History
                  </TabsTrigger>
                  <TabsTrigger value="receivers" className="flex-1">
                    Receivers
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="history" className="mt-4 space-y-2">
                  {history.length ? (
                    history.map((p) => (
                      <div key={p.tracking} className="flex items-center justify-between rounded-xl border border-border p-3">
                        <div>
                          <p className="text-sm font-medium">{p.tracking}</p>
                          <p className="text-xs text-muted-foreground">{p.destination}</p>
                        </div>
                        <StatusPill status={p.status} />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No parcels for this customer yet.</p>
                  )}
                </TabsContent>
                <TabsContent value="receivers" className="mt-4 text-sm text-muted-foreground">
                  Saved receivers will appear as customers reuse destinations.
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a customer to view details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
