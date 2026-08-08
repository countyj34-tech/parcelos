import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Banknote, Building2, Clock, MapPin, Package, Users } from "lucide-react";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: "Reports — ParcelOS" }] }),
  component: ReportsPage,
});

const REPORTS = [
  { title: "Today's revenue", value: "K 88,420", icon: Banknote },
  { title: "Weekly revenue", value: "K 412,800", icon: Banknote },
  { title: "Monthly revenue", value: "K 1.84M", icon: Banknote },
  { title: "Parcel performance", value: "96.4% on time", icon: Package },
  { title: "Branch performance", value: "Cairo Road leads", icon: Building2 },
  { title: "Outstanding parcels", value: "214", icon: Clock },
  { title: "Delayed deliveries", value: "14", icon: Clock },
  { title: "Top routes", value: "Lusaka → Ndola", icon: MapPin },
  { title: "Top customers", value: "Kondwani Zulu", icon: Users },
];

function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Simple operational reports"
        actions={
          <>
            <Button variant="outline" className="rounded-xl"><Download className="mr-2 h-4 w-4" /> Export PDF</Button>
            <Button variant="outline" className="rounded-xl"><FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <StatCard key={r.title} label={r.title} value={r.value} icon={r.icon} />
        ))}
      </div>
    </div>
  );
}
