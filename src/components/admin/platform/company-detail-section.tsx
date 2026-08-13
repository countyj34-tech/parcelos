import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, LogIn, Pause, Play, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/status-pill";
import { useCompanyLifecycleActions, usePlatformCompanies } from "@/hooks/use-companies";
import { getCompanyBySlug } from "@/lib/platform-data";
import { money } from "@/lib/mock-data";
import { TICKETS } from "@/lib/mock-data";
import { isCompanyAccessBlocked } from "@/lib/company-lifecycle";
import { toast } from "sonner";

export function CompanyDetailSection({ slug }: { slug: string }) {
  const actions = useCompanyLifecycleActions();
  const { data: companies } = usePlatformCompanies();
  const company = companies?.find((c) => c.slug === slug) ?? getCompanyBySlug(slug);

  if (!company) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Company not found.</p>
        <Button asChild className="mt-4">
          <Link to="/admin" search={{ section: "companies" }}>
            Back
          </Link>
        </Button>
      </div>
    );
  }

  const blocked = isCompanyAccessBlocked(company.status);

  return (
    <div>
      <Link
        to="/admin"
        search={{ section: "companies" }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All companies
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
            {company.logoInitials}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-sm text-muted-foreground">
              {company.code} · {company.country} · {company.subdomain}
            </p>
          </div>
          <StatusPill status={company.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/app">
              <LogIn className="mr-2 h-4 w-4" /> Open workspace
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <a href={`/c/${company.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Customer portal
            </a>
          </Button>
          {blocked ? (
            <Button
              className="rounded-lg"
              onClick={() => {
                void actions.reactivate(slug).then((ok) => {
                  if (ok) toast.success(`${company.name} reactivated`);
                });
              }}
            >
              <Play className="mr-2 h-4 w-4" /> Reactivate
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  void actions.pause(slug).then((ok) => {
                    if (ok) {
                      toast.message(`${company.name} paused`, {
                        description: "Staff app and customer portal are locked.",
                      });
                    }
                  });
                }}
              >
                <Pause className="mr-2 h-4 w-4" /> Pause
              </Button>
              <Button
                variant="outline"
                className="rounded-lg text-destructive"
                onClick={() => {
                  void actions.suspend(slug).then((ok) => {
                    if (ok) {
                      toast.error(`${company.name} suspended`, {
                        description: "Kill switch on — non-payment lock.",
                      });
                    }
                  });
                }}
              >
                <ShieldOff className="mr-2 h-4 w-4" /> Suspend
              </Button>
            </>
          )}
          <Button
            variant="outline"
            className="rounded-lg text-destructive"
            onClick={() => {
              if (!window.confirm(`Remove ${company.name}? Their portal and workspace will be cut off.`)) return;
              void actions.remove(slug).then((ok) => {
                if (ok) toast.error(`${company.name} disconnected`);
              });
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Remove
          </Button>
        </div>
      </div>

      {blocked ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Kill switch is on. Customers and staff for this company see a locked screen until you reactivate.
        </p>
      ) : null}

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="flex h-auto flex-wrap gap-1">
          {[
            "overview",
            "subscription",
            "billing",
            "branches",
            "users",
            "storage",
            "sms",
            "activity",
            "parcels",
            "tickets",
            "logins",
          ].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Plan", company.plan],
              ["Branches", String(company.branches)],
              ["Users", String(company.users)],
              ["Parcels today", String(company.parcelsToday)],
              ["Storage", company.storage],
              ["MRR", money(company.mrr, "K")],
              ["Expiry", company.expiryDate],
              ["Created", company.createdDate],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="mt-1 text-lg font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="subscription" className="mt-6">
          <div className="rounded-xl border border-border p-6">
            <p className="font-semibold">{company.plan} plan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Expires {company.expiryDate} · Auto-renewal {company.autoRenewal ? "on" : "off"}
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm">Upgrade</Button>
              <Button size="sm" variant="outline">
                Downgrade
              </Button>
              <Button size="sm" variant="outline">
                Extend trial
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <div className="rounded-xl border border-border p-6">
            <p className="font-semibold">Outstanding balance</p>
            <p className="mt-1 text-2xl font-bold">
              {company.outstanding ? money(company.outstanding, "K") : "None"}
            </p>
            <Button size="sm" variant="outline" className="mt-4 rounded-lg">
              View invoices
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="branches" className="mt-6">
          <p className="text-sm text-muted-foreground">{company.branches} branches configured</p>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <p className="text-sm text-muted-foreground">{company.users} workspace users</p>
        </TabsContent>

        <TabsContent value="storage" className="mt-6">
          <p className="text-2xl font-bold">{company.storage}</p>
          <p className="text-sm text-muted-foreground">Total storage used</p>
        </TabsContent>

        <TabsContent value="activity" className="mt-6 space-y-2">
          {["468 parcels processed today", "Admin logged in 2 hrs ago", "Subscription renewed 14 days ago"].map(
            (a) => (
              <div key={a} className="rounded-lg border border-border px-4 py-3 text-sm">
                {a}
              </div>
            ),
          )}
        </TabsContent>

        <TabsContent value="parcels" className="mt-6">
          <p className="text-2xl font-bold">{company.parcelsToday}</p>
          <p className="text-sm text-muted-foreground">Parcels processed today</p>
        </TabsContent>

        <TabsContent value="logins" className="mt-6 space-y-2">
          {["Admin · Lusaka HQ · 2 hrs ago", "Dispatcher · Ndola · Yesterday"].map((l) => (
            <div key={l} className="rounded-lg border border-border px-4 py-3 text-sm">
              {l}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="tickets" className="mt-6 space-y-3">
          {TICKETS.filter((t) => t.company === company.name).map((t) => (
            <div key={t.id} className="flex justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-muted-foreground">{t.id}</p>
              </div>
              <StatusPill status={t.status} />
            </div>
          ))}
          {!TICKETS.some((t) => t.company === company.name) ? (
            <p className="text-sm text-muted-foreground">No support tickets.</p>
          ) : null}
        </TabsContent>

        <TabsContent value="sms" className="mt-6">
          <p className="text-2xl font-bold">{company.smsUsed.toLocaleString()} SMS used this month</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
