import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Banknote,
  CalendarClock,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  Printer,
  Search,
  Share2,
  Truck,
  UserPlus,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { SharePortalPanel } from "@/components/dashboard/share-portal-panel";
import { StatCard, StatusCard } from "@/components/dashboard/stat-card";
import { ProductMeta } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { ACTIVITIES, DASHBOARD_STATS, PARCELS } from "@/lib/mock-data";
import { StatusPill } from "@/components/status-pill";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: ProductMeta("Dashboard") }] }),
  component: DashboardHome,
});

function DashboardHome() {
  const { user, role } = useAuth();
  const { tenant } = useTenant();
  const s = DASHBOARD_STATS;
  const isReceptionist = role === "Receptionist";
  const canShare = role === "Company Admin" || role === "Branch Manager" || role === "Super Admin";

  if (isReceptionist) {
    return (
      <div>
        <PageHeader
          title={`Hello, ${user.name.split(" ")[0]}`}
          description={user.branch}
          actions={
            <Button asChild size="lg" className="h-12 rounded-xl px-6">
              <Link to="/app/reception"><PackagePlus className="mr-2 h-5 w-5" /> Open reception</Link>
            </Button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Search customer", to: "/app/reception", icon: Search },
            { label: "Register walk-in", to: "/app/reception/register", icon: UserPlus },
            { label: "Receive payment", to: "/app/reception", icon: Banknote },
            { label: "Print labels", to: "/app/reception", icon: Printer },
          ].map((a) => (
            <Button key={a.label} asChild variant="outline" className="h-16 justify-start rounded-2xl text-base">
              <Link to={a.to}><a.icon className="mr-3 h-5 w-5" />{a.label}</Link>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={`Good morning, ${user.name.split(" ")[0]}`} description="Today's operations at a glance" />

      {canShare ? (
        <section className="card-elevated overflow-hidden p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Share2 className="h-4 w-4 text-primary" />
                Launch {tenant.name} for customers
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Share your link or QR — customers open your branded portal only.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/app/settings">Full share tools</Link>
            </Button>
          </div>
          <SharePortalPanel compact />
        </section>
      ) : null}

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Today's parcels" value={s.todayParcels} icon={PackagePlus} />
        <StatCard label="Waiting drop-off" value={s.waitingDropOff} icon={CalendarClock} accent="#3B82F6" />
        <StatCard label="In stock" value={s.inStock} icon={Warehouse} accent="#F59E0B" />
        <StatCard label="In transit" value={s.inTransit} icon={Truck} accent="#8B5CF6" />
        <StatCard label="Ready for collection" value={s.readyCollection} icon={PackageSearch} accent="#10B981" />
        <StatCard label="Delivered today" value={s.deliveredToday} icon={PackageCheck} accent="#059669" />
        <StatCard label="Today's revenue" value={s.revenueToday} icon={Banknote} className="xl:col-span-1" />
      </div>

      {/* Status overview */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Parcel status overview</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {s.statusBreakdown.map((st) => (
            <StatusCard key={st.label} label={st.label} count={st.count} color={st.color} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Latest activity */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Latest parcel activity</h2>
          <ul className="mt-4 space-y-3">
            {PARCELS.slice(0, 5).map((p) => (
              <li key={p.tracking} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.tracking}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.sender} → {p.receiver}</p>
                </div>
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        </section>

        {/* Staff activity */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Today's staff activity</h2>
          <ul className="mt-4 space-y-4">
            {ACTIVITIES.map((a) => (
              <li key={a.what} className="flex gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="text-sm"><span className="font-semibold">{a.who}</span> <span className="text-muted-foreground">{a.what}</span></p>
                  <p className="text-xs text-muted-foreground">{a.when}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Register walk-in", to: "/app/reception", icon: UserPlus },
            { label: "Search parcel", to: "/app/parcels", icon: Search },
            { label: "Receive parcel", to: "/app/reception", icon: PackagePlus },
            { label: "Dispatch vehicle", to: "/app/dispatch", icon: Truck },
            { label: "Print labels", to: "/app/reception", icon: Printer },
          ].map((a) => (
            <Button key={a.label} asChild variant="outline" className="h-14 rounded-2xl">
              <Link to={a.to}><a.icon className="mr-2 h-4 w-4" />{a.label}</Link>
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
