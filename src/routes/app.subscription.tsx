import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/app/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription — ParcelOS" },
      { name: "description", content: "Your plan, usage and invoices for the Swift Logistics workspace." },
      { property: "og:title", content: "Subscription — ParcelOS" },
      { property: "og:description", content: "Plan, usage and invoices." },
    ],
  }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  return (
    <div>
      <PageHeader title="Subscription" description="Enterprise plan · renews 1 April 2026" />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-elevated p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Enterprise</h2>
              <p className="text-sm text-muted-foreground">Unlimited branches, API access, SSO, 99.9% SLA</p>
            </div>
            <p className="font-display text-3xl font-bold">
              $4,800<span className="text-base font-medium text-muted-foreground">/mo</span>
            </p>
          </div>
          <div className="mt-6 space-y-5">
            {[
              ["Branches", 12, 50],
              ["Staff accounts", 96, 250],
              ["Parcels this month", 5040, 20000],
              ["SMS credits", 18400, 50000],
            ].map(([label, used, limit]) => (
              <div key={label as string}>
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-muted-foreground">
                    {(used as number).toLocaleString()} / {(limit as number).toLocaleString()}
                  </span>
                </div>
                <Progress value={((used as number) / (limit as number)) * 100} className="mt-2 h-2" />
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button className="rounded-full">Manage plan</Button>
            <Button variant="outline" className="rounded-full">Buy SMS credits</Button>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h2 className="text-lg font-semibold">Invoices</h2>
          <div className="mt-4 space-y-3">
            {[
              ["INV-2026-0031", "1 Mar 2026", "$4,800", "Paid"],
              ["INV-2026-0022", "1 Feb 2026", "$4,800", "Paid"],
              ["INV-2026-0014", "1 Jan 2026", "$4,800", "Paid"],
            ].map(([id, date, amt, status]) => (
              <div key={id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{id}</p>
                  <p className="text-xs text-muted-foreground">{date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{amt}</p>
                  <p className="inline-flex items-center gap-1 text-xs text-success">
                    <Check className="h-3 w-3" /> {status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
