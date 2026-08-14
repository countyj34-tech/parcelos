import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Send } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ClientOnly } from "@/components/client-only";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { usePlatformCompanies, usePlatformConsoleBundle, usePlatformOverviewStats } from "@/hooks/use-companies";
import { fetchPlatformPayments } from "@/lib/api/payments";
import { formatStorageBytes, sendConsoleBroadcast, setConsoleFlag, updateConsolePlan } from "@/lib/api/platform-console";
import {
  confirmManualSaasPayment,
  fetchSaasRevenueDashboard,
  listPendingManualPayments,
  listPlatformPaymentAccounts,
  listRecentSaasPayments,
  savePlatformPaymentAccount,
  type PlatformPaymentAccount,
} from "@/lib/api/platform-billing";
import { toast } from "sonner";
import { money } from "@/lib/money";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_OWNER } from "@/lib/brand";

export function PlansSection() {
  const queryClient = useQueryClient();
  const { data: bundle } = usePlatformConsoleBundle();
  const plans = bundle?.plans ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (code: string, price: number) => {
    setEditing(code);
    setPriceDraft(String(price));
  };

  const savePrice = async (code: string) => {
    const major = Number(priceDraft);
    if (!Number.isFinite(major) || major < 0) {
      toast.error("Enter a valid price in Kwacha");
      return;
    }
    setSaving(true);
    try {
      const ok = await updateConsolePlan({ code, priceMajor: major });
      if (!ok) throw new Error("Update failed — apply migration 36");
      toast.success(`${code} set to K${major.toLocaleString()}/mo`);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["platform", "bundle"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save price");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Plans"
        description="Set live ZMW prices companies pay each month"
      />
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plans in the database yet. Apply migration 36.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.code}</p>
                </div>
                {p.code === "starter" ? (
                  <span className="rounded-full bg-teal-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-teal-700">
                    Default
                  </span>
                ) : null}
              </div>

              {editing === p.code ? (
                <div className="mt-4 space-y-3">
                  <Label>Monthly price (ZMW)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">K</span>
                    <Input
                      inputMode="decimal"
                      className="h-12 rounded-xl text-lg font-bold"
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button className="h-11 flex-1 rounded-xl" disabled={saving} onClick={() => void savePrice(p.code)}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="outline" className="h-11 rounded-xl" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-4 font-display text-3xl font-bold tracking-tight text-primary">
                    {p.price > 0 ? `K${p.price.toLocaleString()}` : "Custom"}
                    {p.price > 0 ? <span className="text-sm font-medium text-muted-foreground">/mo</span> : null}
                  </p>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Branches</dt><dd>{p.branches || "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Users</dt><dd>{p.users || "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Storage</dt><dd>{p.storage}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">SMS / month</dt><dd>{p.sms.toLocaleString()}</dd></div>
                  </dl>
                  <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                    {p.features.map((f) => <li key={f}>· {f}</li>)}
                  </ul>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                    <span>{p.companies} companies</span>
                    <Button size="sm" className="h-10 rounded-xl px-4" onClick={() => startEdit(p.code, p.price)}>
                      Set price
                    </Button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function SubscriptionsSection() {
  const { data: companies = [] } = usePlatformCompanies();
  return (
    <div>
      <AdminPageHeader title="Subscriptions" description="Live subscriptions across all courier companies" />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Company</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Auto renewal</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">No companies yet</TableCell>
              </TableRow>
            ) : (
              companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.plan}</TableCell>
                  <TableCell className="text-muted-foreground">{c.startDate}</TableCell>
                  <TableCell className="text-muted-foreground">{c.expiryDate}</TableCell>
                  <TableCell>{c.autoRenewal ? "Yes" : "No"}</TableCell>
                  <TableCell>{money(c.mrr, c.currency || "ZMW")}</TableCell>
                  <TableCell><StatusPill status={c.status} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function BillingSection() {
  const { data: companies = [] } = usePlatformCompanies();
  const { data: payments = [] } = useQuery({
    queryKey: ["platform", "payments"],
    queryFn: fetchPlatformPayments,
    staleTime: 30_000,
  });
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["platform", "payment-accounts"],
    queryFn: listPlatformPaymentAccounts,
    staleTime: 15_000,
  });
  const { data: pending = [], refetch: refetchPending } = useQuery({
    queryKey: ["platform", "pending-manual"],
    queryFn: listPendingManualPayments,
    staleTime: 10_000,
  });
  const { data: revenue } = useQuery({
    queryKey: ["platform", "saas-revenue"],
    queryFn: fetchSaasRevenueDashboard,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
  const { data: recentSaasRpc = [] } = useQuery({
    queryKey: ["platform", "saas-payments"],
    queryFn: () => listRecentSaasPayments(40),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
  const { data: bundle } = usePlatformConsoleBundle();
  const recentSaas = recentSaasRpc.length
    ? recentSaasRpc
    : (bundle?.saasPayments ?? []).map((row) => ({
        id: row.id,
        txRef: row.txRef,
        amountMajor: row.amountMajor,
        amountPlatform: row.amountPlatform,
        amountProvider: row.amountProvider,
        currencyCode: row.currencyCode,
        status: row.status,
        paymentPath: row.paymentPath,
        companyName: row.companyName,
        planName: row.planName,
        months: row.months,
        updatedAt: row.updatedAt,
      }));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformPaymentAccount | null>(null);
  const [draft, setDraft] = useState({
    kind: "mobile_money" as "mobile_money" | "bank",
    provider: "mtn",
    label: "",
    accountName: "",
    accountNumber: "",
    bankBranch: "",
    sortCode: "",
    instructions: "",
    sortOrder: 0,
  });
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const openEdit = (a?: PlatformPaymentAccount) => {
    setFormOpen(true);
    if (a) {
      setEditing(a);
      setDraft({
        kind: a.kind,
        provider: a.provider,
        label: a.label,
        accountName: a.accountName,
        accountNumber: a.accountNumber,
        bankBranch: a.bankBranch ?? "",
        sortCode: a.sortCode ?? "",
        instructions: a.instructions ?? "",
        sortOrder: a.sortOrder,
      });
    } else {
      setEditing(null);
      setDraft({
        kind: "bank",
        provider: "uba",
        label: "UBA Bank Zambia",
        accountName: "",
        accountNumber: "",
        bankBranch: "",
        sortCode: "",
        instructions: "Bank transfer · put the payment reference in the narration",
        sortOrder: 20,
      });
    }
  };

  const onSaveAccount = async () => {
    if (!draft.label.trim() || !draft.accountNumber.trim() || !draft.accountName.trim()) {
      toast.error("Label, account name, and number are required");
      return;
    }
    setSaving(true);
    try {
      await savePlatformPaymentAccount({
        id: editing?.id,
        ...draft,
        isActive: true,
      });
      toast.success(editing ? "Account updated" : "Account added");
      setFormOpen(false);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["platform", "payment-accounts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onConfirm = async (txRef: string) => {
    setConfirming(txRef);
    try {
      await confirmManualSaasPayment(txRef);
      toast.success(`Confirmed ${txRef} — company unlocked`);
      void refetchPending();
      void queryClient.invalidateQueries({ queryKey: ["platform", "saas-revenue"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "saas-payments"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setConfirming(null);
    }
  };

  const invoices = companies.map((c, i) => ({
    id: `INV-${c.code || i}`,
    company: c.name,
    amount: c.mrr,
    status: c.outstanding > 0 ? "Failed" : c.status === "Past due" ? "Past due" : "Paid",
    date: c.expiryDate,
  }));

  const fmtK = (n: number) => `K${n.toLocaleString("en-ZM", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Billing"
        description="Live SaaS revenue, GenesysPay auto-payments, and manual confirm"
        actions={
          <Button className="rounded-lg" onClick={() => openEdit()}>
            <Plus className="mr-2 h-4 w-4" /> Add account
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Your cut today" value={fmtK(revenue?.platformToday ?? 0)} />
        <StatCard label="Your cut this month" value={fmtK(revenue?.platformMonth ?? 0)} />
        <StatCard label="Gross this month" value={fmtK(revenue?.revenueMonth ?? 0)} />
        <StatCard label="Paid companies" value={String(revenue?.activePaidCompanies ?? 0)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="All-time your cut" value={fmtK(revenue?.platformAllTime ?? 0)} />
        <StatCard label="AT reserve (month)" value={fmtK(revenue?.providerMonth ?? 0)} />
        <StatCard label="Successful pays (month)" value={String(revenue?.successCountMonth ?? 0)} />
        <StatCard label="Pending manual" value={String(revenue?.pendingManualCount ?? pending.length)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Recent SaaS payments</h2>
          <p className="text-xs text-muted-foreground">Genesys auto + manual — refreshes every minute</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>When</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Cover</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Your cut</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentSaas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No SaaS payments yet
                </TableCell>
              </TableRow>
            ) : (
              recentSaas.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.updatedAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>{row.companyName}</TableCell>
                  <TableCell className="text-xs">
                    {row.planName} · {row.months} mo
                  </TableCell>
                  <TableCell className="text-xs capitalize">{row.paymentPath}</TableCell>
                  <TableCell>{fmtK(row.amountMajor)}</TableCell>
                  <TableCell className="text-emerald-700">{fmtK(row.amountPlatform)}</TableCell>
                  <TableCell>
                    <StatusPill status={row.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="text-sm font-semibold">Receive payments here</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Companies see these on Subscription — put your real MTN / Airtel / UBA / Access numbers.
        </p>
        {accountsLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{a.kind === "bank" ? "Bank" : "Mobile Money"}</p>
                    <p className="font-semibold">{a.label}</p>
                    <p className="text-sm text-muted-foreground">{a.accountName}</p>
                    <p className="mt-1 font-mono text-sm font-bold">{a.accountNumber}</p>
                    {a.bankBranch ? <p className="text-xs text-muted-foreground">Branch: {a.bankBranch}</p> : null}
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openEdit(a)}>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
            {!accounts.length ? (
              <p className="text-sm text-muted-foreground md:col-span-2">No accounts yet — add MTN, Airtel, UBA, Access…</p>
            ) : null}
          </div>
        )}

        {formOpen ? (
          <div className="mt-5 grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Type</Label>
              <Select
                value={draft.kind}
                onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as "mobile_money" | "bank" }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Provider code</Label>
              <Input
                className="rounded-xl"
                value={draft.provider}
                onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))}
                placeholder="mtn / airtel / uba / access"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                className="rounded-xl"
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="MTN Mobile Money"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account name</Label>
              <Input
                className="rounded-xl"
                value={draft.accountName}
                onChange={(e) => setDraft((d) => ({ ...d, accountName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Number / account</Label>
              <Input
                className="rounded-xl"
                value={draft.accountNumber}
                onChange={(e) => setDraft((d) => ({ ...d, accountNumber: e.target.value }))}
                placeholder="097… or bank account"
              />
            </div>
            {draft.kind === "bank" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Input
                    className="rounded-xl"
                    value={draft.bankBranch}
                    onChange={(e) => setDraft((d) => ({ ...d, bankBranch: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sort / branch code</Label>
                  <Input
                    className="rounded-xl"
                    value={draft.sortCode}
                    onChange={(e) => setDraft((d) => ({ ...d, sortCode: e.target.value }))}
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Instructions</Label>
              <Input
                className="rounded-xl"
                value={draft.instructions}
                onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button className="rounded-xl" disabled={saving} onClick={() => void onSaveAccount()}>
                {saving ? "Saving…" : "Save account"}
              </Button>
              <Button variant="ghost" className="rounded-xl" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Pending direct payments</h2>
          <p className="text-xs text-muted-foreground">
            Confirm after MoMo/bank credit — split shows ParcelOS vs Africa&apos;s Talking
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Reference</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Cover</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Your cut</TableHead>
              <TableHead>AT reserve</TableHead>
              <TableHead>Via</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No pending claims
                </TableCell>
              </TableRow>
            ) : (
              pending.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs font-semibold">{row.txRef}</TableCell>
                  <TableCell>{row.companyName}</TableCell>
                  <TableCell className="text-xs">
                    {row.planName} · {row.months} mo
                    {row.smsCredits ? ` · ${row.smsCredits.toLocaleString()} SMS` : ""}
                    {row.whatsappMonths ? ` · WA ${row.whatsappMonths}m` : ""}
                  </TableCell>
                  <TableCell>K{row.amountMajor.toLocaleString("en-ZM", { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-emerald-700">
                    K{row.amountPlatform.toLocaleString("en-ZM", { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-amber-700">
                    K{row.amountProvider.toLocaleString("en-ZM", { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.accountLabel ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="rounded-lg"
                      disabled={confirming === row.txRef || row.status !== "submitted"}
                      onClick={() => void onConfirm(row.txRef)}
                    >
                      {confirming === row.txRef ? "…" : row.status === "submitted" ? "Confirm & unlock" : "Waiting claim"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Companies", String(companies.length)],
          ["Payments recorded", String(payments.length)],
          ["Past due", String(companies.filter((c) => c.status === "Past due").length)],
          ["Suspended", String(companies.filter((c) => c.status === "Suspended" || c.status === "Paused").length)],
        ].map(([l, v]) => (
          <StatCard key={l} label={l} value={v} />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Companies &amp; subscription status</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Ref</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Plan / MRR</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No companies registered yet
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.id}</TableCell>
                  <TableCell>{inv.company}</TableCell>
                  <TableCell>{money(inv.amount, "K")}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.date}</TableCell>
                  <TableCell>
                    <StatusPill status={inv.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function SmsCenterSection() {
  const { data: bundle } = usePlatformConsoleBundle();
  const used = bundle?.sms.usedMonth ?? 0;
  const total = bundle?.sms.total ?? 0;
  const top = bundle?.sms.top ?? [];
  const cap = Math.max(used, 1);
  const usedPct = Math.min(100, Math.round((used / cap) * 100));

  return (
    <div className="space-y-6">
      <AdminPageHeader title="SMS Center" description="Live SMS usage across all courier companies" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="All-time SMS" value={total.toLocaleString()} />
        <StatCard label="Used this month" value={used.toLocaleString()} />
        <StatCard label="Companies sending" value={String(top.filter((c) => c.smsUsed > 0).length)} />
        <StatCard label="Parcels today" value={String(top.reduce((s, c) => s + c.parcelsToday, 0))} />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">This month vs last count</span>
          <span>{usedPct}%</span>
        </div>
        <Progress value={usedPct} className="mt-2 h-2" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Top companies</h2></div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Company</TableHead>
              <TableHead>SMS used (MTD)</TableHead>
              <TableHead>Parcels today</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-muted-foreground">No SMS traffic yet</TableCell></TableRow>
            ) : top.map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.smsUsed.toLocaleString()}</TableCell>
                <TableCell>{c.parcelsToday}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function NotificationsSection() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSending(true);
    try {
      const count = await sendConsoleBroadcast(title.trim(), body.trim());
      toast.success(`Sent to ${count} companies`);
      setTitle("");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["platform", "bundle"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Broadcast failed — apply migration 35");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Notifications" description="Broadcast to every active courier company" />
      <div className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-lg" placeholder="Maintenance tonight" />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Input value={body} onChange={(e) => setBody(e.target.value)} className="h-11 rounded-lg" placeholder="What should companies see?" />
        </div>
        <Button className="rounded-lg" disabled={sending} onClick={() => void send()}>
          <Send className="mr-2 h-4 w-4" /> {sending ? "Sending…" : "Send broadcast"}
        </Button>
      </div>
    </div>
  );
}

export function SupportSection() {
  const { data: bundle } = usePlatformConsoleBundle();
  const tickets = bundle?.tickets ?? [];
  const stats = bundle?.ticketStats ?? { open: 0, feature: 0, bug: 0, chat: 0 };
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Support Center" description="Live tickets from courier companies" />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Open tickets" value={String(stats.open)} />
        <StatCard label="Feature requests" value={String(stats.feature)} />
        <StatCard label="Bug reports" value={String(stats.bug)} />
        <StatCard label="Live chat" value={String(stats.chat)} />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Ticket</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">No support tickets yet</TableCell></TableRow>
            ) : tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell><p className="font-medium">{t.subject}</p><p className="text-xs text-muted-foreground">{t.id}</p></TableCell>
                <TableCell>{t.company}</TableCell>
                <TableCell>{t.priority}</TableCell>
                <TableCell className="text-muted-foreground">{t.age}</TableCell>
                <TableCell><StatusPill status={t.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function AnalyticsSection() {
  const { data: live } = usePlatformOverviewStats();
  const charts = [
    { title: "Revenue (ZMW)", data: live?.charts.revenue ?? [] },
    { title: "Companies", data: live?.charts.companyGrowth ?? [] },
    { title: "Parcels", data: live?.charts.parcels ?? [] },
    { title: "SMS usage", data: live?.charts.sms ?? [] },
  ];
  return (
    <div>
      <AdminPageHeader title="Analytics" description="Live platform growth and usage" />
      <div className="grid gap-5 lg:grid-cols-2">
        {charts.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold">{c.title}</h2>
            <div className="mt-4 h-52">
              <ClientOnly>
                {() => (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={c.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ClientOnly>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeatureFlagsSection() {
  const queryClient = useQueryClient();
  const { data: bundle } = usePlatformConsoleBundle();
  const flags = bundle?.flags ?? [];

  return (
    <div>
      <AdminPageHeader title="Feature flags" description="Live flags stored in Supabase" />
      <div className="rounded-xl border border-border bg-card shadow-card divide-y divide-border">
        {flags.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No feature flags seeded yet.</p>
        ) : flags.map((f) => (
          <div key={f.key} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.key}</p>
            </div>
            <Switch
              checked={f.enabled}
              onCheckedChange={(on) => {
                void setConsoleFlag(f.key, on).then((ok) => {
                  if (ok) {
                    toast.success(`${f.label} ${on ? "on" : "off"}`);
                    void queryClient.invalidateQueries({ queryKey: ["platform", "bundle"] });
                  } else {
                    toast.error("Could not update flag — apply migration 35");
                  }
                });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DomainsSection() {
  const { data: bundle } = usePlatformConsoleBundle();
  const domains = bundle?.domains ?? [];
  return (
    <div>
      <AdminPageHeader title="Domains" description="Live subdomains and custom domains" />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Company</TableHead>
              <TableHead>Hostname</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>SSL</TableHead>
              <TableHead>Verified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">No domains registered</TableCell></TableRow>
            ) : domains.map((d) => (
              <TableRow key={`${d.company}-${d.hostname}`}>
                <TableCell className="font-medium">{d.company}</TableCell>
                <TableCell className="text-primary">{d.hostname}</TableCell>
                <TableCell className="text-muted-foreground">{d.type}</TableCell>
                <TableCell><StatusPill status={d.ssl} /></TableCell>
                <TableCell>{d.verified ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function StorageSection() {
  const { data: bundle } = usePlatformConsoleBundle();
  const storage = bundle?.storage;
  const rows = storage?.companies ?? [];
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Storage" description="Live storage usage from Supabase" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Platform storage" value={formatStorageBytes(storage?.bytes ?? 0)} />
        <StatCard label="Files" value={(storage?.files ?? 0).toLocaleString()} />
        <StatCard label="Companies" value={String(rows.length)} />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Company</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Images</TableHead>
              <TableHead>Documents</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground">No storage records yet</TableCell></TableRow>
            ) : rows.map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{formatStorageBytes(c.bytes)}</TableCell>
                <TableCell className="text-muted-foreground">{formatStorageBytes(c.images)}</TableCell>
                <TableCell className="text-muted-foreground">{formatStorageBytes(c.documents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  const { data: accounts = [] } = useQuery({
    queryKey: ["platform", "payment-accounts"],
    queryFn: listPlatformPaymentAccounts,
    staleTime: 15_000,
  });
  const { data: companies = [] } = usePlatformCompanies();
  return (
    <div>
      <AdminPageHeader title="Integrations" description="Live connected payment rails and company count" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="font-semibold">Courier companies</p>
          <p className="mt-2 text-2xl font-bold">{companies.length}</p>
          <p className="text-xs text-muted-foreground">Provisioned on ParcelOS</p>
        </div>
        {accounts.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.kind === "bank" ? "Bank" : "Mobile money"} · {a.provider}</p>
              </div>
              <StatusPill status={a.isActive ? "Active" : "Suspended"} />
            </div>
            <p className="mt-3 font-mono text-sm">{a.accountNumber}</p>
          </div>
        ))}
        {!accounts.length ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">No payment accounts yet — add them under Billing.</p>
        ) : null}
      </div>
    </div>
  );
}

export function PlatformSettingsSection() {
  return (
    <div>
      <AdminPageHeader title="Platform settings" description="ParcelOS operator identity" />
      <div className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        {[
          ["Platform name", "ParcelOS"],
          ["Operator", PLATFORM_OWNER],
          ["Owner email", "mthunzilabs@gmail.com"],
          ["Default currency", "ZMW"],
        ].map(([label, val]) => (
          <div key={label} className="space-y-2">
            <Label>{label}</Label>
            <Input defaultValue={val} readOnly className="h-11 rounded-lg bg-muted/40" />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Company workspaces, plans, and kill-switch live in Supabase. Logo pattern opens this console.
        </p>
      </div>
    </div>
  );
}

export function AuditLogsSection() {
  const { data: bundle } = usePlatformConsoleBundle();
  const [query, setQuery] = useState("");
  const logs = (bundle?.audit ?? []).filter((l) =>
    query === "" || [l.action, l.target, l.actor, l.description].join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div>
      <AdminPageHeader title="Audit logs" description="Live record of platform actions" />
      <div className="mb-4">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actions, targets, actors…" className="h-10 max-w-md rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground">No audit events yet</TableCell></TableRow>
            ) : logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.action}</TableCell>
                <TableCell>{l.target}</TableCell>
                <TableCell className="text-muted-foreground">{l.actor}</TableCell>
                <TableCell className="text-muted-foreground">{l.when}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function SystemLogsSection() {
  const { data: bundle } = usePlatformConsoleBundle();
  const logs = bundle?.systemLogs ?? [];
  return (
    <div>
      <AdminPageHeader title="System logs" description="Live infrastructure and application logs" />
      <div className="rounded-xl border border-border bg-card font-mono text-xs shadow-card">
        {logs.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No system logs recorded yet.</div>
        ) : logs.map((l) => (
          <div key={l.when + l.msg} className="flex gap-4 border-b border-border px-4 py-3 last:border-0">
            <span className="text-muted-foreground">{l.when}</span>
            <span className={l.level === "ERROR" ? "text-destructive" : l.level === "WARN" || l.level === "WARNING" ? "text-amber-600" : "text-emerald-600"}>{l.level}</span>
            <span className="flex-1">{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlatformUsersSection() {
  const { data: bundle } = usePlatformConsoleBundle();
  const users = bundle?.platformUsers ?? [];
  return (
    <div>
      <AdminPageHeader title="Platform users" description="MTHUNZI-TECH-LABS team in Supabase" />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground">No platform users linked yet. Run bootstrap_platform_admin in SQL if needed.</TableCell></TableRow>
            ) : users.map((u) => (
              <TableRow key={u.email}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell className="text-muted-foreground">{u.lastActive}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function CustomersSection() {
  const { data: bundle } = usePlatformConsoleBundle();
  const c = bundle?.customers ?? { total: 0, activeMonth: 0, new: 0 };
  return (
    <div>
      <AdminPageHeader title="Customers" description="End customers across all courier companies" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total customers" value={c.total.toLocaleString()} />
        <StatCard label="Active this month" value={c.activeMonth.toLocaleString()} />
        <StatCard label="New this month" value={c.new.toLocaleString()} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">Customer records stay in each company workspace. Open a company to drill down.</p>
    </div>
  );
}

export function AccountSection() {
  const { user } = useAuth();
  return (
    <div>
      <AdminPageHeader title="My account" description="SaaS owner profile for this console" />
      <div className="max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="space-y-2"><Label>Full name</Label><Input defaultValue={user.name} readOnly className="h-11 rounded-lg bg-muted/40" /></div>
        <div className="space-y-2"><Label>Email</Label><Input defaultValue={user.email} readOnly className="h-11 rounded-lg bg-muted/40" /></div>
        <div className="space-y-2"><Label>Role</Label><Input defaultValue="Super Admin" disabled className="h-11 rounded-lg" /></div>
        <p className="text-xs text-muted-foreground">This console opens with the logo pattern — no separate platform login.</p>
      </div>
    </div>
  );
}
