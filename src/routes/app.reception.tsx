import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Calculator,
  Check,
  PackagePlus,
  Receipt,
  Search,
  Tag,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { PaymentDialog } from "@/components/dashboard/payment-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import { PARCELS, money } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/reception")({
  head: () => ({ meta: [{ title: "Reception — ParcelOS" }] }),
  component: ReceptionPage,
});

type SearchMode = "phone" | "reference" | "tracking";

function ReceptionPage() {
  const parcel = PARCELS[6]!; // Waiting for Drop-off
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("phone");
  const [found, setFound] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);

  const actions = [
    { id: "verify", label: "Verify parcel", icon: BadgeCheck },
    { id: "fee", label: "Calculate shipping fee", icon: Calculator },
    { id: "payment", label: "Receive payment", icon: Wallet },
    { id: "receipts", label: "Print 3 receipts", icon: Receipt },
    { id: "label", label: "Print parcel label", icon: Tag },
    { id: "complete", label: "Complete registration", icon: Check },
  ] as const;

  const runAction = (id: string) => {
    if (id === "payment") {
      setPaymentOpen(true);
      return;
    }
    setCompleted((c) => (c.includes(id) ? c : [...c, id]));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reception" description="Search, verify, charge and release parcels" />

      {/* Walk-in CTA */}
      <Button asChild size="lg" className="h-16 w-full rounded-2xl text-base font-semibold sm:w-auto sm:px-10">
        <Link to="/portal/register">
          <PackagePlus className="mr-2 h-5 w-5" /> Register new walk-in parcel
        </Link>
      </Button>

      {/* Search */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-medium text-muted-foreground">Search by</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["phone", "Phone number"],
              ["reference", "Reference number"],
              ["tracking", "Tracking number"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                mode === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                mode === "phone"
                  ? "+260 977 214 880"
                  : mode === "reference"
                    ? "POS-249077-UG"
                    : "POS-249071-ZM"
              }
              className="h-14 rounded-2xl pl-12 text-base"
            />
          </div>
          <Button size="lg" className="h-14 shrink-0 rounded-2xl px-8" onClick={() => setFound(true)}>
            Search
          </Button>
        </div>
      </div>

      {found ? (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Parcel info */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference</p>
                <p className="font-display text-2xl font-bold">{parcel.tracking}</p>
              </div>
              <StatusPill status={parcel.status} />
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoBlock title="Sender" items={[["Name", parcel.sender], ["Phone", parcel.senderPhone]]} />
              <InfoBlock title="Receiver" items={[["Name", parcel.receiver], ["Phone", parcel.receiverPhone]]} />
              <InfoBlock
                title="Parcel"
                items={[
                  ["Description", `${parcel.category} — ${parcel.weight}`],
                  ["Declared value", money(parcel.declaredValue)],
                  ["Destination", parcel.destination],
                ]}
              />
              <InfoBlock title="Status" items={[["Current", parcel.status], ["Payment", parcel.payment], ["Fee", money(parcel.amount)]]} />
            </dl>
          </div>

          {/* Actions */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="text-lg font-semibold">Actions</p>
            <p className="mt-1 text-sm text-muted-foreground">Complete each step in order.</p>
            <div className="mt-5 space-y-2">
              {actions.map((a) => {
                const done = completed.includes(a.id);
                return (
                  <Button
                    key={a.id}
                    variant={done ? "secondary" : "outline"}
                    className="h-14 w-full justify-start rounded-xl text-base"
                    onClick={() => runAction(a.id)}
                  >
                    <a.icon className="mr-3 h-5 w-5" />
                    {a.label}
                    {done ? <Check className="ml-auto h-4 w-4 text-emerald-600" /> : null}
                  </Button>
                );
              })}
            </div>
            <div className="mt-6 rounded-2xl bg-muted/50 p-5 text-center">
              <p className="text-sm text-muted-foreground">Amount due</p>
              <p className="mt-1 font-display text-4xl font-bold">{money(parcel.amount)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-lg font-medium">Search for a customer or parcel</p>
          <p className="mt-1 text-sm text-muted-foreground">Enter a phone number, reference or tracking number above.</p>
        </div>
      )}

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        shippingFee={parcel.amount}
        declaredValue={parcel.declaredValue}
        onFinish={() => setCompleted((c) => [...c, "payment"])}
      />
    </div>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[][] }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <dl className="mt-3 space-y-2">
        {items.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
