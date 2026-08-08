import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { COMPANIES } from "@/lib/mock-data";

export const Route = createFileRoute("/app/companies")({
  head: () => ({
    meta: [
      { title: "Courier companies — ParcelOS" },
      { name: "description", content: "Every courier company workspace on the platform with plan, branches and revenue." },
      { property: "og:title", content: "Courier companies — ParcelOS" },
      { property: "og:description", content: "Company workspaces, plans and revenue." },
    ],
  }),
  component: CompaniesPage,
});

function CompaniesPage() {
  return (
    <div>
      <PageHeader title="Companies" description="6 courier companies across 6 African markets" />
      <div className="card-elevated overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Company</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COMPANIES.map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.country}</TableCell>
                <TableCell>{c.branches}</TableCell>
                <TableCell>{c.users}</TableCell>
                <TableCell>{c.plan}</TableCell>
                <TableCell>${c.mrr.toLocaleString()}</TableCell>
                <TableCell>
                  <StatusPill status={c.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
