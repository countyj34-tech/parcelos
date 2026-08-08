import { createFileRoute } from "@tanstack/react-router";
import { Phone, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { BRANCH_CARDS, money } from "@/lib/mock-data";

export const Route = createFileRoute("/app/branches")({
  head: () => ({ meta: [{ title: "Branches — ParcelOS" }] }),
  component: BranchesPage,
});

function BranchesPage() {
  return (
    <div>
      <PageHeader title="Branches" description="6 active branches" actions={<Button className="rounded-xl"><Plus className="mr-2 h-4 w-4" /> Create branch</Button>} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {BRANCH_CARDS.map((b) => (
          <div key={b.code} className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{b.name}</h2>
                <p className="text-sm text-muted-foreground">Manager · {b.manager}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Open</span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Today's parcels</dt><dd className="text-xl font-bold">{b.parcelsToday}</dd></div>
              <div><dt className="text-muted-foreground">Today's revenue</dt><dd className="text-xl font-bold">{money(b.revenue)}</dd></div>
              <div><dt className="text-muted-foreground">Staff</dt><dd className="font-semibold">{b.staff}</dd></div>
              <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{b.phone}</div>
            </dl>

            <div className="mt-5 flex gap-2">
              <Button size="sm" className="flex-1 rounded-xl">Open</Button>
              <Button size="sm" variant="outline" className="flex-1 rounded-xl">Edit</Button>
              <Button size="sm" variant="ghost" className="rounded-xl text-muted-foreground">Disable</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
