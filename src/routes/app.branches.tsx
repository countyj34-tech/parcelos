import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Phone, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompanyBranches } from "@/hooks/use-parcels";
import { createCompanyBranch, setBranchActive } from "@/lib/api/company-admin";
import { money } from "@/lib/money";
import { toast } from "sonner";

export const Route = createFileRoute("/app/branches")({
  head: () => ({ meta: [{ title: "Branches — ParcelOS" }] }),
  component: BranchesPage,
});

function BranchesPage() {
  const queryClient = useQueryClient();
  const { data: branches = [], isLoading } = useCompanyBranches();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("Lusaka");
  const [phone, setPhone] = useState("");

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["company-branches"] });

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error("Branch name is required");
      return;
    }
    setBusy(true);
    try {
      await createCompanyBranch({ name, code, city, phone });
      toast.success("Branch created");
      setOpen(false);
      setName("");
      setCode("");
      setPhone("");
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["branch-names"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create branch");
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (id: string, active: boolean) => {
    try {
      await setBranchActive(id, !active);
      toast.success(active ? "Branch closed" : "Branch opened");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Branches"
        description={isLoading ? "Loading…" : `${branches.length} branch${branches.length === 1 ? "" : "es"}`}
        actions={
          <Button className="rounded-xl" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create branch
          </Button>
        }
      />

      {isLoading ? (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading branches…
        </div>
      ) : null}

      {!isLoading && branches.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No branches yet. Create your first counter location.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => (
            <div key={b.id} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{b.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {b.code}
                    {b.isHeadOffice ? " · Head office" : ""}
                    {b.city ? ` · ${b.city}` : ""}
                  </p>
                </div>
                <span
                  className={
                    b.isActive
                      ? "rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                      : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {b.isActive ? "Open" : "Closed"}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Today&apos;s parcels</dt>
                  <dd className="text-xl font-bold">{b.parcelsToday}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Today&apos;s revenue</dt>
                  <dd className="text-xl font-bold">{money(b.revenueToday)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Staff assigned</dt>
                  <dd className="font-semibold">{b.staffCount}</dd>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {b.phone || "—"}
                </div>
              </dl>

              <div className="mt-5">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => void onToggle(b.id, b.isActive)}
                >
                  {b.isActive ? "Close branch" : "Reopen branch"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create branch</DialogTitle>
            <DialogDescription>Add a counter location for reception and dispatch.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Branch name</Label>
              <Input
                className="rounded-xl"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ndola — Broadway"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input
                  className="rounded-xl"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="NDO-BRD"
                />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input className="rounded-xl" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input className="rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" disabled={busy} onClick={() => void onCreate()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
