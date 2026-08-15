import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Pencil, Phone, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompanyBranches } from "@/hooks/use-parcels";
import { createCompanyBranch, deleteCompanyBranch, setBranchActive, updateCompanyBranch } from "@/lib/api/company-admin";
import { coordsForCity, ZM_CITY_OPTIONS } from "@/lib/geo-zm";
import type { CompanyBranch } from "@/lib/api/company-ops";
import { money } from "@/lib/money";
import { toast } from "sonner";

export const Route = createFileRoute("/app/branches")({
  head: () => ({ meta: [{ title: "Branches — ParcelOS" }] }),
  component: BranchesPage,
});

type FormState = {
  id?: string;
  name: string;
  code: string;
  city: string;
  phone: string;
  address: string;
  latitude: string;
  longitude: string;
};

const emptyForm = (): FormState => ({
  name: "",
  code: "",
  city: "Lusaka",
  phone: "",
  address: "",
  latitude: "",
  longitude: "",
});

function BranchesPage() {
  const queryClient = useQueryClient();
  const { data: branches = [], isLoading } = useCompanyBranches();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["company-branches"] });
    void queryClient.invalidateQueries({ queryKey: ["branch-names"] });
    void queryClient.invalidateQueries({ queryKey: ["company-dashboard"] });
  };

  const openCreate = () => {
    const next = emptyForm();
    const coords = coordsForCity(next.city);
    setForm({
      ...next,
      latitude: coords ? String(coords.lat) : "",
      longitude: coords ? String(coords.lng) : "",
    });
    setOpen(true);
  };

  const openEdit = (b: CompanyBranch) => {
    setForm({
      id: b.id,
      name: b.name,
      code: b.code,
      city: b.city || "Lusaka",
      phone: b.phone || "",
      address: b.address || "",
      latitude: b.latitude != null ? String(b.latitude) : "",
      longitude: b.longitude != null ? String(b.longitude) : "",
    });
    setOpen(true);
  };

  const setCity = (city: string) => {
    const coords = coordsForCity(city);
    setForm((f) => ({
      ...f,
      city,
      latitude: coords ? String(coords.lat) : f.latitude,
      longitude: coords ? String(coords.lng) : f.longitude,
    }));
  };

  const pinHere = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location is not available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
        toast.success("Office pin set from this phone");
      },
      () => toast.error("Allow location, then try again — stand at the counter."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      toast.error("Branch name is required");
      return;
    }
    setBusy(true);
    try {
      const lat = form.latitude.trim() ? Number(form.latitude) : null;
      const lng = form.longitude.trim() ? Number(form.longitude) : null;
      if (form.id) {
        await updateCompanyBranch({
          id: form.id,
          name: form.name,
          code: form.code,
          city: form.city,
          phone: form.phone,
          address: form.address,
          latitude: Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
        });
        toast.success("Branch updated");
      } else {
        await createCompanyBranch({
          name: form.name,
          code: form.code,
          city: form.city,
          phone: form.phone,
          address: form.address,
          latitude: Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
        });
        toast.success("Branch created");
      }
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save branch");
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

  const onDelete = async (b: CompanyBranch) => {
    if (!window.confirm(`Delete ${b.name}? It will disappear from this list and from drop-off / collect pickers.`)) return;
    try {
      await deleteCompanyBranch(b.id);
      queryClient.setQueryData(["company-branches"], (old: CompanyBranch[] | undefined) =>
        (old ?? []).filter((row) => row.id !== b.id),
      );
      toast.success(`${b.name} deleted`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete branch");
    }
  };

  return (
    <div>
      <PageHeader
        title="Branches"
        description={isLoading ? "Loading…" : `${branches.length} branch${branches.length === 1 ? "" : "es"}`}
        actions={
          <Button className="rounded-xl" onClick={openCreate}>
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
          No branches yet. Create your first counter location and pin GPS so live tracking can detect arrival.
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
              <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {b.latitude != null && b.longitude != null
                  ? `${b.latitude.toFixed(4)}, ${b.longitude.toFixed(4)}`
                  : "No GPS pin yet — edit and use “Pin this office”"}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openEdit(b)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void onToggle(b.id, b.isActive)}>
                  {b.isActive ? "Close" : "Reopen"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="col-span-2 rounded-xl text-destructive"
                  onClick={() => void onDelete(b)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit branch" : "Create branch"}</DialogTitle>
            <DialogDescription>
              Pin the counter GPS so live tracking can mark Arrived when the vehicle reaches this office.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Branch name</Label>
              <Input
                className="rounded-xl"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ndola — Broadway"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input
                  className="rounded-xl"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="NDO-BRD"
                />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Select value={form.city} onValueChange={setCity}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZM_CITY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    {form.city && !ZM_CITY_OPTIONS.includes(form.city as (typeof ZM_CITY_OPTIONS)[number]) ? (
                      <SelectItem value={form.city}>{form.city}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                className="rounded-xl"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Street / building"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input className="rounded-xl" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Latitude</Label>
                <Input className="rounded-xl" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Longitude</Label>
                <Input className="rounded-xl" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} />
              </div>
            </div>
            <Button type="button" variant="secondary" className="rounded-xl" onClick={pinHere}>
              <MapPin className="mr-2 h-4 w-4" /> Pin this office (use my location)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" disabled={busy} onClick={() => void onSave()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
