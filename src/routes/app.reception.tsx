import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, PackagePlus, Printer, Search, Wallet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import {
  finalizeReceptionPayment,
  searchReceptionParcels,
  type ReceptionSearchMode,
} from "@/lib/api/parcels";
import { money } from "@/lib/money";
import { printParcelReceipts } from "@/lib/print-receipts";
import { clearReceptionRegisterMode } from "@/lib/portal-mode";
import type { Parcel } from "@/lib/types/parcel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/app/reception")({
  head: () => ({ meta: [{ title: "Reception — ParcelOS" }] }),
  component: ReceptionPage,
});

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  mobile_money: "Mobile Money",
  card: "Card",
  bank_transfer: "Bank Transfer",
};

function ReceptionPage() {
  const { companyId } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  useEffect(() => {
    clearReceptionRegisterMode();
  }, []);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ReceptionSearchMode>("tracking");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Parcel[]>([]);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [fee, setFee] = useState("");
  const [weight, setWeight] = useState("");
  const [method, setMethod] = useState<"cash" | "mobile_money" | "card" | "bank_transfer">("cash");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const onSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) {
      toast.error("Enter a tracking code or phone number");
      return;
    }
    setSearching(true);
    setDone(false);
    setParcel(null);
    const rows = await searchReceptionParcels(mode, query);
    setResults(rows);
    setSearching(false);
    if (!rows.length) {
      toast.message("No parcel found");
      return;
    }
    if (rows.length === 1) {
      selectParcel(rows[0]!);
    }
  };

  const selectParcel = (p: Parcel) => {
    setParcel(p);
    setFee(p.amount > 0 ? String(p.amount) : "");
    setWeight(p.weight.replace(/[^\d.]/g, "") || "");
    setDone(p.payment === "Paid");
  };

  const onComplete = async () => {
    if (!parcel?.id && !parcel) {
      toast.error("Select a parcel first");
      return;
    }
    const feeNum = Number(fee);
    if (!Number.isFinite(feeNum) || feeNum <= 0) {
      toast.error("Enter the shipping price");
      return;
    }

    setSaving(true);
    const company = companyId || tenant.id;
    if (!parcel.id || !/^[0-9a-f-]{36}$/i.test(parcel.id) || !/^[0-9a-f-]{36}$/i.test(company)) {
      toast.error("This parcel is not linked to the live database yet");
      setSaving(false);
      return;
    }
    const result = await finalizeReceptionPayment({
      parcelId: parcel.id,
      companyId: company,
      feeMajor: feeNum,
      methodType: method,
      weightKg: weight ? Number(weight) : null,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Could not save payment");
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["parcels"] });
    void queryClient.invalidateQueries({ queryKey: ["company-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["company-payments"] });
    void queryClient.invalidateQueries({ queryKey: ["company-customers"] });
    void queryClient.invalidateQueries({ queryKey: ["company-branches"] });

    const updated = {
      ...parcel,
      amount: feeNum,
      payment: "Paid" as const,
      status: "Received" as const,
      weight: weight ? `${weight} kg` : parcel.weight,
    };
    setParcel(updated);
    setDone(true);

    const printed = printParcelReceipts({
      tenant,
      parcel: updated,
      fee: feeNum,
      methodLabel: METHOD_LABELS[method] ?? method,
      copies: 3,
    });

    if (printed) {
      toast.success("Payment saved — printing 3 receipt copies");
    } else {
      toast.success("Payment saved", {
        description: "Allow pop-ups to print the 3 receipts.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reception"
        description="Look up a drop-off code, set the fee, and print receipts"
      />

      <Button asChild size="lg" className="h-16 w-full rounded-2xl text-base font-semibold sm:w-auto sm:px-10">
        <Link to="/app/reception/register">
          <PackagePlus className="mr-2 h-5 w-5" /> Register new parcel
        </Link>
      </Button>

      <form
        className="rounded-2xl border border-border bg-card p-6 shadow-card"
        onSubmit={(e) => void onSearch(e)}
      >
        <p className="text-sm font-medium text-muted-foreground">Find parcel by</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["tracking", "Tracking / reference"],
              ["phone", "Phone number"],
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
              placeholder={mode === "phone" ? "+260 …" : "POS-249071-ZM"}
              className="h-14 rounded-2xl pl-12 text-base"
            />
          </div>
          <Button type="submit" size="lg" className="h-14 shrink-0 rounded-2xl px-8" disabled={searching}>
            {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Search"}
          </Button>
        </div>
      </form>

      {results.length > 1 && !parcel ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Select a parcel</p>
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.id ?? r.tracking}>
                <button
                  type="button"
                  onClick={() => selectParcel(r)}
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-muted/40"
                >
                  <span>
                    <span className="font-semibold">{r.tracking}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {r.sender} → {r.receiver}
                    </span>
                  </span>
                  <StatusPill status={r.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parcel ? (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tracking</p>
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
                  ["Route", `${parcel.origin} → ${parcel.destination}`],
                  ["Declared", money(parcel.declaredValue)],
                ]}
              />
              <InfoBlock
                title="Status"
                items={[
                  ["Payment", parcel.payment],
                  ["Current fee", money(parcel.amount)],
                ]}
              />
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="text-lg font-semibold">Counter checkout</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the fee from the rate chart, take payment, then print 3 receipts.
            </p>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Shipping price (ZMW)</Label>
                <Input
                  inputMode="decimal"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0.00"
                  className="h-12 rounded-xl text-lg font-semibold"
                  disabled={done}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Weight kg (optional)</Label>
                <Input
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="h-12 rounded-xl"
                  disabled={done}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <Select
                  value={method}
                  onValueChange={(v) => setMethod(v as typeof method)}
                  disabled={done}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-muted/50 p-5 text-center">
              <p className="text-sm text-muted-foreground">Amount due</p>
              <p className="mt-1 font-display text-4xl font-bold">
                {money(Number(fee) || 0)}
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {!done ? (
                <Button
                  className="h-14 rounded-xl text-base"
                  disabled={saving || !parcel.id}
                  onClick={() => void onComplete()}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Wallet className="mr-2 h-5 w-5" />
                  )}
                  Take payment &amp; print 3 receipts
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-14 rounded-xl text-base"
                  onClick={() =>
                    printParcelReceipts({
                      tenant,
                      parcel,
                      fee: Number(fee) || parcel.amount,
                      methodLabel: METHOD_LABELS[method] ?? method,
                      copies: 3,
                    })
                  }
                >
                  <Printer className="mr-2 h-5 w-5" /> Reprint 3 receipts
                </Button>
              )}
              {!parcel.id ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Demo parcel — connect Supabase and search a real tracking code to save payments.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-lg font-medium">Search for a drop-off code</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Customers bring the reference from the portal — look it up, price it, print receipts.
          </p>
        </div>
      )}
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
