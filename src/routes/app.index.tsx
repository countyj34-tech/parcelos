import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Banknote,
  CalendarClock,
  Loader2,
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
import { useCompanyDashboard } from "@/hooks/use-parcels";
import { StatusPill } from "@/components/status-pill";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: ProductMeta("Dashboard") }] }),
  component: DashboardHome,
});

function DashboardHome() {
  const { user, role } = useAuth();
  const { tenant } = useTenant();
  const { data: stats, isLoading } = useCompanyDashboard();
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
              <Link to="/app/reception">
                <PackagePlus className="mr-2 h-5 w-5" /> Open reception
              </Link>
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
              <Link to={a.to}>
                <a.icon className="mr-3 h-5 w-5" />
                {a.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const s = stats ?? {
    todayParcels: 0,
    waitingDropOff: 0,
    inStock: 0,
    inTransit: 0,
    readyCollection: 0,
    deliveredToday: 0,
    revenueToday: "ZMW 0",
    statusBreakdown: [],
    recentParcels: [],
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description={
          isLoading
            ? "Loading live operations…"
            : isSupabaseConfigured()
              ? "Live operations for your company"
              : "Connect Supabase to see live data"
        }
      />

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

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Syncing dashboard…
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Today's parcels" value={s.todayParcels} icon={PackagePlus} />
        <StatCard label="Waiting drop-off" value={s.waitingDropOff} icon={CalendarClock} accent="#3B82F6" />
        <StatCard label="In stock" value={s.inStock} icon={Warehouse} accent="#F59E0B" />
        <StatCard label="In transit" value={s.inTransit} icon={Truck} accent="#8B5CF6" />
        <StatCard label="Ready for collection" value={s.readyCollection} icon={PackageSearch} accent="#10B981" />
        <StatCard label="Delivered today" value={s.deliveredToday} icon={PackageCheck} accent="#059669" />
        <StatCard label="Today's revenue" value={s.revenueToday} icon={Banknote} className="xl:col-span-1" />
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Parcel status overview</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {s.statusBreakdown.length ? (
            s.statusBreakdown.map((st) => (
              <StatusCard key={st.label} label={st.label} count={st.count} color={st.color} />
            ))
          ) : (
            <p className="col-span-full text-sm text-muted-foreground">No parcels yet — register the first one at reception.</p>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Latest parcel activity</h2>
          <ul className="mt-4 space-y-3">
            {s.recentParcels.length ? (
              s.recentParcels.map((p) => (
                <li key={p.tracking} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.tracking}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.sender} → {p.receiver}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">No activity yet.</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Quick actions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Register walk-in", to: "/app/reception/register", icon: UserPlus },
              { label: "Search parcel", to: "/app/parcels", icon: Search },
              { label: "Reception desk", to: "/app/reception", icon: PackagePlus },
              { label: "Dispatch", to: "/app/dispatch", icon: Truck },
            ].map((a) => (
              <Button key={a.label} asChild variant="outline" className="h-14 rounded-2xl">
                <Link to={a.to}>
                  <a.icon className="mr-2 h-4 w-4" />
                  {a.label}
                </Link>
              </Button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
