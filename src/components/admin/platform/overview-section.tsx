import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Building2, HardDrive, Megaphone, MessageSquare, Plus, TrendingUp, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ClientOnly } from "@/components/client-only";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { usePlatformCompanies, usePlatformConsoleBundle, usePlatformOverviewStats } from "@/hooks/use-companies";
import { fetchPlatformPayments } from "@/lib/api/payments";
import {
  getCompanyLifecycleSnapshot,
  isCompanyAccessBlocked,
  subscribeCompanyLifecycle,
} from "@/lib/company-lifecycle";

function fmtCount(value: number | undefined) {
  return (value ?? 0).toLocaleString();
}

export function OverviewSection() {
  const { data: liveStats } = usePlatformOverviewStats();
  const { data: bundle } = usePlatformConsoleBundle();
  const { data: companies = [] } = usePlatformCompanies();
  const { data: payments = [] } = useQuery({
    queryKey: ["platform", "payments"],
    queryFn: fetchPlatformPayments,
    staleTime: 30_000,
  });
  useSyncExternalStore(subscribeCompanyLifecycle, getCompanyLifecycleSnapshot, () => "");
  const demoSuspended = companies.filter((c) => isCompanyAccessBlocked(c.status)).length;
  const k = {
    activeCompanies: liveStats?.activeCompanies ?? companies.filter((c) => c.status === "Active").length,
    trialCompanies: liveStats?.trialCompanies ?? companies.filter((c) => c.status === "Trial").length,
    expiredCompanies: liveStats?.expiredCompanies ?? companies.filter((c) => c.status === "Expired").length,
    suspendedCompanies: liveStats?.suspendedCompanies ?? demoSuspended,
    monthlyRevenue: liveStats?.monthlyRevenue ?? companies.reduce((sum, c) => sum + (c.mrr || 0), 0),
    todayParcels: liveStats?.todayParcels ?? companies.reduce((sum, c) => sum + (c.parcelsToday || 0), 0),
    platformUsers: liveStats?.platformUsers ?? companies.reduce((sum, c) => sum + (c.users || 0), 0),
    branches: liveStats?.branches ?? companies.reduce((sum, c) => sum + (c.branches || 0), 0),
    storageUsed: liveStats?.storageUsed ?? "0 GB",
    smsRemaining: liveStats?.smsRemaining ?? 0,
    customerTotal: liveStats?.customerTotal ?? 0,
  };
  const charts = [
    { title: "SaaS revenue (ZMW)", data: liveStats?.charts.revenue ?? [], key: "value" as const },
    { title: "Company growth", data: liveStats?.charts.companyGrowth ?? [], key: "value" as const },
    { title: "Parcels processed", data: liveStats?.charts.parcels ?? [], key: "value" as const },
    { title: "SMS sent", data: liveStats?.charts.sms ?? [], key: "value" as const },
  ];
  const activity = liveStats?.activity?.length ? liveStats.activity : [];
  const tickets = bundle?.tickets?.slice(0, 3) ?? [];

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
        <StatCard label="Monthly revenue" value={k.monthlyRevenue > 0 ? `K${Number(k.monthlyRevenue).toLocaleString()}` : "K0"} icon={TrendingUp} accent="#10B981" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Today's parcels" value={fmtCount(k.todayParcels)} icon={TrendingUp} />
        <StatCard label="Staff users" value={fmtCount(k.platformUsers)} icon={Users} />
        <StatCard label="Branches" value={k.branches ?? 0} icon={Building2} />
        <StatCard label="Storage" value={k.storageUsed ?? "—"} icon={HardDrive} />
        <StatCard label="SMS remaining" value={fmtCount(k.smsRemaining)} icon={MessageSquare} />
      </div>
      <StatCard label="End customers" value={fmtCount(k.customerTotal)} icon={Activity} className="max-w-xs" />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-11 rounded-lg px-5"><Link to="/admin" search={{ section: "create-company" }}><Plus className="mr-2 h-4 w-4" /> Create company</Link></Button>
          <Button asChild variant="outline" className="h-11 rounded-lg px-5"><Link to="/admin" search={{ section: "subscriptions" }}>Create subscription</Link></Button>
          <Button asChild variant="outline" className="h-11 rounded-lg px-5"><Link to="/admin" search={{ section: "notifications" }}><Megaphone className="mr-2 h-4 w-4" /> Send announcement</Link></Button>
          <Button asChild variant="outline" className="h-11 rounded-lg px-5"><Link to="/admin" search={{ section: "notifications" }}><MessageSquare className="mr-2 h-4 w-4" /> Broadcast notification</Link></Button>
        </div>
      </section>

      <ClientOnly>
        {() => (
          <div className="grid gap-5 lg:grid-cols-2">
            {[
              { title: "SaaS revenue (ZMW)", data: charts[0]?.data ?? [], key: "value" as const },
              { title: "Company growth", data: charts[1]?.data ?? [], key: "value" as const },
              { title: "Parcels processed", data: charts[2]?.data ?? [], key: "value" as const },
              { title: "SMS sent", data: charts[3]?.data ?? [], key: "value" as const },
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
        )}
      </ClientOnly>

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
            {tickets.length === 0 ? (
              <li className="text-sm text-muted-foreground">No tickets yet</li>
            ) : (
              tickets.map((t) => (
                <li key={t.id} className="text-sm">
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.company}</p>
                </li>
              ))
            )}
          </ul>
        </FeedCard>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Platform activity</h2>
        <ul className="space-y-2">
          {activity.length === 0 ? (
            <li className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">No activity yet</li>
          ) : (
            activity.map((a) => (
              <li key={`${a.when}-${a.text}`} className="flex justify-between rounded-lg border border-border px-4 py-3 text-sm">
                <span>{a.text}</span>
                <span className="text-muted-foreground">{a.when}</span>
              </li>
            ))
          )}
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
