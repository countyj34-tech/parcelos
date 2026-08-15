import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Navigation, Plus, QrCode, ScanLine, Truck, User } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAuth } from "@/hooks/use-auth";
import { useLiveRun } from "@/hooks/use-live-run";
import { useBranchNames, useCompanyDispatch, useCompanyStaff, useParcels } from "@/hooks/use-parcels";
import { useWorkspaceBranch } from "@/hooks/use-workspace-branch";
import {
  assignDriverToParcels,
  createCompanyVehicle,
  createDispatchDriver,
  dispatchParcels,
  ensureDriverProfile,
  listCompanyDrivers,
  setVehicleActive,
} from "@/lib/api/company-admin";
import { notifyParcelStakeholders } from "@/lib/api/messaging";
import { StatusPill } from "@/components/status-pill";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dispatch")({
  head: () => ({ meta: [{ title: "Dispatch — ParcelOS" }] }),
  component: DispatchPage,
});

function DispatchPage() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const office = useWorkspaceBranch();
  const originOffice = office.isAll ? undefined : office.branchName ?? undefined;
  const originOfficeId = office.isAll ? undefined : office.branchId ?? undefined;
  const { data, isLoading } = useCompanyDispatch();
  const { data: pendingParcels = [], refetch } = useParcels({
    status: "Received",
    branch: originOffice,
    branchId: originOfficeId,
    branchScope: "origin",
  });
  const { data: dispatchedParcels = [] } = useParcels({
    status: "Dispatched",
    branch: originOffice,
    branchId: originOfficeId,
    branchScope: "origin",
  });
  const { data: transitParcels = [] } = useParcels({
    status: "In Transit",
    branch: originOffice,
    branchId: originOfficeId,
    branchScope: "origin",
  });
  const { data: arrivedParcels = [] } = useParcels({
    status: "Arrived",
    branch: originOffice,
    branchId: originOfficeId,
    branchScope: "origin",
  });
  const { data: branches = [] } = useBranchNames(companyId);
  const { data: staff = [] } = useCompanyStaff();
  const vehicles = data?.vehicles ?? [];

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("50");
  const [branchId, setBranchId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [scan, setScan] = useState("");
  const [drivers, setDrivers] = useState<
    Array<{ id: string; name: string; available: boolean; staffId?: string | null }>
  >([]);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [promoteStaffId, setPromoteStaffId] = useState("");
  const [driverOpen, setDriverOpen] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const live = useLiveRun(companyId);
  const onRoad = [...dispatchedParcels, ...transitParcels, ...arrivedParcels];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["company-dispatch"] });
    void queryClient.invalidateQueries({ queryKey: ["parcels"] });
    void queryClient.invalidateQueries({ queryKey: ["company-dashboard"] });
    void refetch();
    void listCompanyDrivers()
      .then(setDrivers)
      .catch(() => setDrivers([]));
  };

  useEffect(() => {
    void listCompanyDrivers()
      .then(setDrivers)
      .catch(() => setDrivers([]));
  }, []);

  const onAddVehicle = async () => {
    if (!registration.trim()) {
      toast.error("Registration number is required");
      return;
    }
    setBusy(true);
    try {
      await createCompanyVehicle({
        registration,
        make,
        model,
        capacityKg: Number(capacity) || 50,
        branchId: branchId || null,
      });
      toast.success("Vehicle added");
      setOpen(false);
      setRegistration("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add vehicle");
    } finally {
      setBusy(false);
    }
  };

  const onPromoteDriver = async () => {
    if (!promoteStaffId) {
      toast.error("Pick a staff member");
      return;
    }
    setBusy(true);
    try {
      const id = await ensureDriverProfile(promoteStaffId);
      toast.success("Driver added from staff");
      refresh();
      setDriverId(id);
      setPromoteStaffId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create driver");
    } finally {
      setBusy(false);
    }
  };

  const onAddDriver = async () => {
    if (!driverName.trim()) {
      toast.error("Enter the driver's name");
      return;
    }
    setBusy(true);
    try {
      const id = await createDispatchDriver({
        name: driverName,
        phone: driverPhone,
        license: driverLicense,
      });
      toast.success("Driver added");
      setDriverOpen(false);
      setDriverName("");
      setDriverPhone("");
      setDriverLicense("");
      setDriverId(id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add driver");
    } finally {
      setBusy(false);
    }
  };

  const onDispatch = async () => {
    const ids = selected.length ? selected : pendingParcels.filter((p) => p.id).map((p) => p.id!);
    if (!ids.length) {
      toast.error("No parcels to dispatch");
      return;
    }
    setBusy(true);
    try {
      if (!companyId) throw new Error("Company not loaded");
      if (driverId) {
        await assignDriverToParcels({ parcelIds: ids, driverId, vehicleId: vehicleId || null });
        toast.success(`Dispatched ${ids.length} parcel(s) to driver`);
      } else {
        await dispatchParcels({ parcelIds: ids, companyId });
        toast.success(`Dispatched ${ids.length} parcel(s)`);
      }
      const picked = pendingParcels.filter((p) => p.id && ids.includes(p.id));
      for (const p of picked) {
        const phone = p.receiverPhone || p.senderPhone;
        if (!phone) continue;
        void notifyParcelStakeholders({
          companyId,
          parcelId: p.id ?? null,
          event: "dispatch",
          phone,
          message: `Your parcel ${p.tracking} is on the way. Track status in the customer portal.`,
        });
      }
      setSelected([]);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  const onScan = () => {
    const q = scan.trim().toUpperCase();
    if (!q) return;
    const match = pendingParcels.find((p) => p.tracking.toUpperCase().includes(q));
    if (!match?.id) {
      toast.message("Parcel not in ready list");
      return;
    }
    setSelected((s) => (s.includes(match.id!) ? s : [...s, match.id!]));
    setScan("");
    toast.success(`Loaded ${match.tracking}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        description="Assign drivers, load vehicles, send parcels"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDriverOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add driver
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add vehicle
            </Button>
            <Button className="rounded-xl" disabled={busy || !pendingParcels.length} onClick={() => void onDispatch()}>
              <Truck className="mr-2 h-4 w-4" /> Dispatch
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Live trip</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Phone stays in the car. Moving → In Transit. Entering the destination city → tracking update. At the office
              pin → Arrived, then Ready for Collection, with SMS/WhatsApp to the receiver.
            </p>
            {onRoad.length ? (
              <p className="mt-2 text-sm">
                {onRoad.length} parcel{onRoad.length === 1 ? "" : "s"} on the road
                {driverId ? " for the selected driver" : " (all vans unless you pick a driver)"}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Dispatch parcels first, then start GPS.</p>
            )}
          </div>
          {live.running ? (
            <Button variant="destructive" className="rounded-xl" disabled={live.busy} onClick={() => void live.stop()}>
              Stop GPS
            </Button>
          ) : (
            <Button
              className="rounded-xl"
              disabled={live.busy || !companyId}
              onClick={() => void live.start(driverId || null, vehicleId || null)}
            >
              {live.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
              Start GPS trip
            </Button>
          )}
        </div>
        {live.running && live.fix ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {live.fix.lat.toFixed(5)}, {live.fix.lng.toFixed(5)}
            {live.fix.accuracy != null ? ` · ±${Math.round(live.fix.accuracy)}m` : ""}
          </p>
        ) : null}
        {live.error ? <p className="mt-2 text-sm text-destructive">{live.error}</p> : null}
        {live.updates.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {live.updates.slice(0, 6).map((u) => (
              <li key={`${u.parcel_id}-${u.to_status ?? u.title}`}>
                <span className="font-medium">{u.tracking}</span> — {u.title}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vehicles" value={vehicles.length} icon={Truck} />
        <StatCard label="Drivers" value={drivers.length || (data?.driversReady ?? 0)} icon={User} />
        <StatCard label="Pending" value={data?.pendingDispatch ?? 0} icon={ScanLine} accent="#F59E0B" />
        <StatCard label="Dispatched today" value={data?.dispatchedToday ?? 0} icon={Truck} accent="#10B981" />
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-card lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Assign driver</Label>
          <Select value={driverId || "none"} onValueChange={(v) => setDriverId(v === "none" ? "" : v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No driver (status only)</SelectItem>
              {drivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Vehicle</Label>
          <Select value={vehicleId || "none"} onValueChange={(v) => setVehicleId(v === "none" ? "" : v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Any</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.registration}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Add driver from staff</Label>
          <div className="flex gap-2">
            <Select value={promoteStaffId || "none"} onValueChange={(v) => setPromoteStaffId(v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select staff</SelectItem>
                {staff
                  .filter((s) => s.status === "Active" && !drivers.some((d) => d.staffId === s.id))
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="shrink-0 rounded-xl" disabled={busy} onClick={() => void onPromoteDriver()}>
              Add
            </Button>
          </div>
          <Button type="button" variant="secondary" className="mt-2 w-full rounded-xl" onClick={() => setDriverOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New driver (name &amp; phone)
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}

      {vehicles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No vehicles yet. Add a truck or van to start.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {vehicles.map((v) => (
            <div key={v.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <p className="font-semibold">
                {v.label} · {v.registration}
              </p>
              <Progress value={v.active ? 35 : 0} className="mt-4 h-2" />
              <Button
                className="mt-4 w-full rounded-xl"
                variant="outline"
                onClick={() =>
                  void setVehicleActive(v.id, !v.active).then(() => {
                    toast.success(v.active ? "Offline" : "Active");
                    refresh();
                  })
                }
              >
                {v.active ? "Set offline" : "Set active"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Scan to load</h2>
          <div className="mt-4 flex gap-2">
            <Input
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onScan())}
              placeholder="Scan tracking…"
              className="h-11 rounded-xl"
            />
            <Button className="rounded-xl" onClick={onScan}>
              <QrCode className="mr-1 h-4 w-4" /> Load
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Ready ({selected.length} selected)</h2>
          <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {pendingParcels.map((p) => (
              <li key={p.tracking} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Checkbox
                  checked={Boolean(p.id && selected.includes(p.id))}
                  onCheckedChange={(c) => {
                    if (!p.id) return;
                    setSelected((s) => (c ? [...s, p.id!] : s.filter((id) => id !== p.id)));
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.tracking}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.origin} → {p.destination}
                  </p>
                </div>
                <StatusPill status={p.status} />
              </li>
            ))}
            {!pendingParcels.length ? <li className="text-sm text-muted-foreground">Nothing waiting.</li> : null}
          </ul>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add vehicle</DialogTitle>
            <DialogDescription>Register fleet for dispatch.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Registration</Label>
              <Input className="rounded-xl" value={registration} onChange={(e) => setRegistration(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input className="rounded-xl" placeholder="Make" value={make} onChange={(e) => setMake(e.target.value)} />
              <Input className="rounded-xl" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <Input className="rounded-xl" placeholder="Capacity kg" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <DialogFooter>
            <Button className="rounded-xl" disabled={busy} onClick={() => void onAddVehicle()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={driverOpen} onOpenChange={setDriverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add driver</DialogTitle>
            <DialogDescription>Name and phone are enough — they do not need a login.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input className="rounded-xl" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Patrick Musonda" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input className="rounded-xl" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="097…" />
            </div>
            <div className="space-y-1.5">
              <Label>License (optional)</Label>
              <Input className="rounded-xl" value={driverLicense} onChange={(e) => setDriverLicense(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button className="rounded-xl" disabled={busy} onClick={() => void onAddDriver()}>
              Save driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
