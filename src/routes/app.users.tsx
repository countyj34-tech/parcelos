import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, UserMinus, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/hooks/use-auth";
import { useBranchNames, useCompanyStaff } from "@/hooks/use-parcels";
import {
  assignStaffBranch,
  createStaffInvite,
  provisionStaff,
  setStaffActive,
  STAFF_ROLE_OPTIONS,
} from "@/lib/api/company-admin";
import { toast } from "sonner";

export const Route = createFileRoute("/app/users")({
  head: () => ({ meta: [{ title: "Staff — ParcelOS" }] }),
  component: StaffPage,
});

function StaffPage() {
  const { companyId, resetPassword } = useAuth();
  const queryClient = useQueryClient();
  const { data: staff = [], isLoading } = useCompanyStaff();
  const { data: branches = [] } = useBranchNames(companyId);
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleCode, setRoleCode] = useState("receptionist");
  const [branchId, setBranchId] = useState<string>("none");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"account" | "link">("account");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["company-staff"] });

  const onInvite = async () => {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      if (mode === "account") {
        if (password.length < 8) {
          toast.error("Temporary password must be at least 8 characters");
          setBusy(false);
          return;
        }
        await provisionStaff({
          email,
          password,
          fullName,
          roleCode,
          phone,
          branchId: branchId === "none" ? null : branchId,
        });
        toast.success("Staff account created — they can sign in now");
      } else {
        const invite = await createStaffInvite({
          email,
          fullName,
          roleCode,
          phone,
          branchId: branchId === "none" ? null : branchId,
        });
        const url = `${window.location.origin}/invite/${invite.token}`;
        setInviteLink(url);
        await navigator.clipboard.writeText(url).catch(() => undefined);
        toast.success("Invite ready — link copied");
      }
      setOpen(false);
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not invite staff");
    } finally {
      setBusy(false);
    }
  };

  const onDeactivate = async (id: string, currentlyActive: boolean) => {
    try {
      await setStaffActive(id, !currentlyActive);
      toast.success(currentlyActive ? "Staff deactivated" : "Staff reactivated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const onAssign = async () => {
    if (!selectedStaffId || branchId === "none") {
      toast.error("Choose a branch");
      return;
    }
    setBusy(true);
    try {
      await assignStaffBranch(selectedStaffId, branchId);
      toast.success("Branch assigned");
      setAssignOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign branch");
    } finally {
      setBusy(false);
    }
  };

  const onReset = async (staffEmail: string) => {
    const result = await resetPassword(staffEmail);
    if (result.error) toast.error(result.error);
    else toast.success("Password reset email sent");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description={isLoading ? "Loading…" : `${staff.length} team member${staff.length === 1 ? "" : "s"}`}
        actions={
          <Button className="rounded-xl" onClick={() => setOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Invite staff
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading staff…
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Staff</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Invite receptionists and branch staff to get started.
                </TableCell>
              </TableRow>
            ) : (
              staff.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {u.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell className="text-muted-foreground">{u.branch}</TableCell>
                  <TableCell>
                    <StatusPill status={u.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Assign branch"
                        onClick={() => {
                          setSelectedStaffId(u.id);
                          setBranchId("none");
                          setAssignOpen(true);
                        }}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Reset password" onClick={() => void onReset(u.email)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={u.status === "Active" ? "Deactivate" : "Reactivate"}
                        onClick={() => void onDeactivate(u.id, u.status === "Active")}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite staff</DialogTitle>
            <DialogDescription>Create a login now, or copy an invite link for them to set a password.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "account" | "link")}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">Create account + temp password</SelectItem>
                  <SelectItem value="link">Invite link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Full name</Label>
              <Input className="rounded-xl" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Work email</Label>
              <Input type="email" className="rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input className="rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={roleCode} onValueChange={setRoleCode}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All / unassigned</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === "account" ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Temporary password</Label>
                <Input
                  type="password"
                  className="rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" disabled={busy} onClick={() => void onInvite()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "account" ? "Create staff" : "Copy invite link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign branch</DialogTitle>
            <DialogDescription>Set the primary branch for this staff member.</DialogDescription>
          </DialogHeader>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button className="rounded-xl" disabled={busy} onClick={() => void onAssign()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(inviteLink)} onOpenChange={(o) => !o && setInviteLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite link ready</DialogTitle>
            <DialogDescription>
              Share this with your teammate. It expires after use — they set their own password.
            </DialogDescription>
          </DialogHeader>
          <Input readOnly className="rounded-xl font-mono text-xs" value={inviteLink ?? ""} />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink ?? "").then(() => toast.success("Copied"));
              }}
            >
              Copy again
            </Button>
            <Button className="rounded-xl" onClick={() => setInviteLink(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
