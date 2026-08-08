import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, UserMinus, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { STAFF_USERS } from "@/lib/mock-data";

export const Route = createFileRoute("/app/users")({
  head: () => ({ meta: [{ title: "Staff — ParcelOS" }] }),
  component: StaffPage,
});

const ROLES = [
  "Company Admin", "Branch Manager", "Receptionist", "Dispatcher",
  "Finance", "Customer Support", "Driver", "Auditor",
];

function StaffPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description={`${STAFF_USERS.length} team members`} actions={<Button className="rounded-xl"><UserPlus className="mr-2 h-4 w-4" /> Create staff</Button>} />

      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <span key={r} className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium">{r}</span>
        ))}
      </div>

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
            {STAFF_USERS.map((u) => (
              <TableRow key={u.email}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{u.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell className="text-muted-foreground">{u.branch}</TableCell>
                <TableCell><StatusPill status={u.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Assign branch"><Users className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Reset password"><KeyRound className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Deactivate"><UserMinus className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
