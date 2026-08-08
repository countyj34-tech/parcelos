import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Eye,
  Filter,
  Loader2,
  LogIn,
  MoreHorizontal,
  Pause,
  Plus,
  Power,
  Search,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { useCompanyLifecycleActions, usePlatformCompanies } from "@/hooks/use-companies";
import { isCompanyAccessBlocked } from "@/lib/company-lifecycle";
import { toast } from "sonner";

export function CompaniesSection() {
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const { data: companies = [], isLoading } = usePlatformCompanies();

  const rows = companies.filter(
    (c) =>
      (plan === "all" || c.plan === plan) &&
      (status === "all" || c.status.toLowerCase() === status.toLowerCase()) &&
      (query === "" || [c.name, c.code, c.country].join(" ").toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div>
      <AdminPageHeader
        title="Courier companies"
        description={`${rows.length} companies on ParcelOS`}
        actions={
          <Button asChild className="rounded-lg">
            <Link to="/admin" search={{ section: "create-company" }}><Plus className="mr-2 h-4 w-4" /> Create company</Link>
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies…" className="h-9 rounded-lg pl-9" />
          </div>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="h-9 w-[140px] rounded-lg"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {["Starter", "Professional", "Enterprise", "Custom"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[140px] rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {["Active", "Trial", "Expired", "Suspended", "Past due", "Paused", "Disconnected"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 rounded-lg"><Filter className="mr-1.5 h-3.5 w-3.5" /> Country</Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading companies…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead />
                  <TableHead>Company</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Branches</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Parcels</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{c.logoInitials}</span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link to="/admin" search={{ section: "company-detail", company: c.slug }} className="hover:text-primary hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.code}</TableCell>
                    <TableCell><StatusPill status={c.status} /></TableCell>
                    <TableCell>{c.plan}</TableCell>
                    <TableCell>{c.trial ? "Yes" : "No"}</TableCell>
                    <TableCell>{c.branches}</TableCell>
                    <TableCell>{c.users}</TableCell>
                    <TableCell>{c.parcelsToday}</TableCell>
                    <TableCell className="text-muted-foreground">{c.storage}</TableCell>
                    <TableCell className="text-muted-foreground">{c.expiryDate}</TableCell>
                    <TableCell className="text-muted-foreground">{c.createdDate}</TableCell>
                    <TableCell>
                      <CompanyActions slug={c.slug} name={c.name} status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyActions({ slug, name, status }: { slug: string; name: string; status: string }) {
  const actions = useCompanyLifecycleActions();
  const blocked = isCompanyAccessBlocked(status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link to="/admin" search={{ section: "company-detail", company: slug }}>
            <Eye className="mr-2 h-3.5 w-3.5" /> Open
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app">
            <LogIn className="mr-2 h-3.5 w-3.5" /> Login as company
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {blocked ? (
          <DropdownMenuItem
            onClick={() => {
              void actions.reactivate(slug).then((ok) => {
                if (ok) toast.success(`${name} reactivated`);
              });
            }}
          >
            <Power className="mr-2 h-3.5 w-3.5" /> Reactivate
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem
              onClick={() => {
                void actions.pause(slug).then((ok) => {
                  if (ok) toast.message(`${name} paused`);
                });
              }}
            >
              <Pause className="mr-2 h-3.5 w-3.5" /> Pause
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void actions.suspend(slug).then((ok) => {
                  if (ok) toast.error(`${name} suspended`);
                });
              }}
            >
              <ShieldOff className="mr-2 h-3.5 w-3.5" /> Suspend
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void actions.disconnect(slug).then((ok) => {
                  if (ok) toast.error(`${name} disconnected`);
                });
              }}
            >
              <Power className="mr-2 h-3.5 w-3.5" /> Disconnect
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => {
            if (!window.confirm(`Remove ${name}?`)) return;
            void actions.remove(slug).then((ok) => {
              if (ok) toast.error(`${name} removed`);
            });
          }}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
