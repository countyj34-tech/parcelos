import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Building2, HardDrive, Megaphone, MessageSquare, Plus, TrendingUp, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { usePlatformCompanies, usePlatformOverviewStats } from "@/hooks/use-companies";
import { fetchPlatformPayments } from "@/lib/api/payments";
import {
  PLATFORM_ACTIVITIES,
  PLATFORM_CHARTS,
  PLATFORM_OVERVIEW,
} from "@/lib/platform-data";
import { TICKETS } from "@/lib/mock-data";
import { isCompanyAccessBlocked, subscribeCompanyLifecycle } from "@/lib/company-lifecycle";

export function OverviewSection() {
  const { data: liveStats } = usePlatformOverviewStats();
  const { data: companies = [] } = usePlatformCompanies();
  const { data: payments = [] } = useQuery({
    queryKey: ["platform", "payments"],
    queryFn: fetchPlatformPayments,
    staleTime: 30_000,
  });
  useSyncExternalStore(subscribeCompanyLifecycle, () => Date.now(), () => 0);
  const demoSuspended = companies.filter((c) => isCompanyAccessBlocked(c.status)).length;
  const k = liveStats
    ? { ...PLATFORM_OVERVIEW, ...liveStats, monthlyRevenue: PLATFORM_OVERVIEW.monthlyRevenue }
    : {
        ...PLATFORM_OVERVIEW,
        activeCompanies: companies.filter((c) => c.status === "Active").length,
        trialCompanies: companies.filter((c) => c.status === "Trial").length,
        expiredCompanies: companies.filter((c) => c.status === "Expired").length,
        suspendedCompanies: demoSuspended,
        totalCompanies: companies.length,
      };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Overview"
        description="ParcelOS platform at a glance"
        actions={
          <>
            <Button asChild variant="outline" className="rounded-lg"><Link to="/admin" search={{ section: "create-company" }}><Plus className="mr-2 h-4 w-4" /> Create company</Link></Button>
            <Button asChild className="rounded-lg"><Link to="/admin" search={{ section: "notifications" }}><Megaphone className="mr-2 h-4 w-4" /> Broadcast</Link></Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active companies" value={k.activeCompanies} icon={Building2} />
        <StatCard label="Trial companies" value={k.trialCompanies} icon={Users} accent="#3B82F6" />
        <StatCard label="Expired" value={k.expiredCompanies} icon={Building2} accent="#EF4444" />
        <StatCard label="Suspended" value={k.suspendedCompanies} icon={Building2} accent="#F59E0B" />
        <StatCard label="Monthly revenue" value={`$${(k.monthlyRevenue / 1000).toFixed(0)}k`} icon={TrendingUp} accent="#10B981" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Today's parcels" value={k.todayParcels.toLocaleString()} icon={TrendingUp} />
        <StatCard label="Platform users" value={k.platformUsers.toLocaleString()} icon={Users} />
        <StatCard label="Branches" value={k.branches} icon={Building2} />
        <StatCard label="Storage" value={k.storageUsed} icon={HardDrive} />
        <StatCard label="SMS remaining" value={(k.smsRemaining / 1000).toFixed(0) + "k"} icon={MessageSquare} />
      </div>
      <StatCard label="API requests (24h)" value={k.apiRequests} icon={Activity} className="max-w-xs" />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-11 rounded-lg px-5"><Link to="/admin" search={{ section: "create-company" }}><Plus className="mr-2 h-4 w-4" /> Create company</Link></Button>
          <Button asChild variant="outline" className="h-11 rounded-lg px-5"><Link to="/admin" search={{ section: "subscriptions" }}>Create subscription</Link></Button>
          <Button asChild variant="outline" className="h-11 rounded-lg px-5"><Link to="/admin" search={{ section: "notifications" }}><Megaphone className="mr-2 h-4 w-4" /> Send announcement</Link></Button>
          <Button asChild variant="outline" className="h-11 rounded-lg px-5"><Link to="/admin" search={{ section: "notifications" }}><MessageSquare className="mr-2 h-4 w-4" /> Broadcast notification</Link></Button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { title: "Monthly revenue", data: PLATFORM_CHARTS.revenue, key: "value" as const },
          { title: "Company growth", data: PLATFORM_CHARTS.companyGrowth, key: "value" as const },
          { title: "Parcels processed", data: PLATFORM_CHARTS.parcels, key: "value" as const },
          { title: "Subscription growth", data: PLATFORM_CHARTS.subscriptions, key: "value" as const },
        ].map((chart) => (
          <div key={chart.title} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold">{chart.title}</h2>
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip />
                  <Area type="monotone" dataKey={chart.key} stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <FeedCard title="Latest registrations">
          <Table>
            <TableBody>
              {companies.slice(0, 4).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><StatusPill status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </FeedCard>
        <FeedCard title="Recent payments">
          <ul className="space-y-3">
            {payments.length === 0 ? (
              <li className="text-sm text-muted-foreground">No payments yet</li>
            ) : (
              payments.slice(0, 5).map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span>{p.company}{p.tracking ? ` · ${p.tracking}` : ""}</span>
                  <span className="font-medium">{p.amount}</span>
                </li>
              ))
            )}
          </ul>
        </FeedCard>
        <FeedCard title="Support tickets">
          <ul className="space-y-3">
            {TICKETS.slice(0, 3).map((t) => (
              <li key={t.id} className="text-sm">
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-muted-foreground">{t.company}</p>
              </li>
            ))}
          </ul>
        </FeedCard>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Platform activity</h2>
        <ul className="space-y-2">
          {PLATFORM_ACTIVITIES.map((a) => (
            <li key={a.text} className="flex justify-between rounded-lg border border-border px-4 py-3 text-sm">
              <span>{a.text}</span>
              <span className="text-muted-foreground">{a.when}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FeedCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}
