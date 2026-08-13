import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Megaphone, Plus, Send } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { usePlatformCompanies } from "@/hooks/use-companies";
import { fetchPlatformPayments } from "@/lib/api/payments";
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
import {
  AUDIT_LOGS,
  FEATURE_FLAGS,
  INTEGRATIONS,
  PLATFORM_CHARTS,
  PLATFORM_COMPANIES,
  PLATFORM_DOMAINS,
  PLATFORM_OVERVIEW,
  PLATFORM_USERS_LIST,
  SUBSCRIPTION_PLANS,
} from "@/lib/platform-data";
import { PLATFORM_KPIS, TICKETS, money } from "@/lib/mock-data";

export function PlansSection() {
  return (
    <div>
      <AdminPageHeader
        title="Plans"
        description="Subscription tiers available on ParcelOS"
        actions={<Button className="rounded-lg"><Plus className="mr-2 h-4 w-4" /> Create plan</Button>}
      />
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {SUBSCRIPTION_PLANS.map((p) => (
          <article key={p.name} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <span className="text-sm font-bold text-primary">{p.price}</span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Branches</dt><dd>{p.branches}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Users</dt><dd>{p.users}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Storage</dt><dd>{p.storage}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">SMS</dt><dd>{p.sms}</dd></div>
            </dl>
            <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
              {p.features.map((f) => <li key={f}>· {f}</li>)}
            </ul>
            <div className="mt-5 flex justify-between border-t border-border pt-4 text-sm">
              <span>{p.companies} companies</span>
              <span className="font-semibold">${p.revenue.toLocaleString()}/mo</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 rounded-lg">Edit</Button>
              <Button size="sm" variant="ghost" className="rounded-lg">Disable</Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function SubscriptionsSection() {
  return (
    <div>
      <AdminPageHeader title="Subscriptions" description="Active subscriptions across all companies" />
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
            {PLATFORM_COMPANIES.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.plan}</TableCell>
                <TableCell className="text-muted-foreground">{c.startDate}</TableCell>
                <TableCell className="text-muted-foreground">{c.expiryDate}</TableCell>
                <TableCell>{c.autoRenewal ? "Yes" : "No"}</TableCell>
                <TableCell>{money(c.mrr, "K")}</TableCell>
                <TableCell><StatusPill status={c.status} /></TableCell>
              </TableRow>
            ))}
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
  const { data: recentSaas = [] } = useQuery({
    queryKey: ["platform", "saas-payments"],
    queryFn: () => listRecentSaasPayments(40),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

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
  const k = PLATFORM_OVERVIEW;
  const usedPct = Math.round((PLATFORM_KPIS.smsUsedThisMonth / (PLATFORM_KPIS.smsUsedThisMonth + k.smsRemaining)) * 100);
  const top = [...PLATFORM_COMPANIES].sort((a, b) => b.smsUsed - a.smsUsed).slice(0, 5);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="SMS Center"
        description="Platform-wide SMS usage and providers"
        actions={<Button className="rounded-lg">Recharge SMS</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total SMS" value="1.2M" />
        <StatCard label="Remaining" value={k.smsRemaining.toLocaleString()} />
        <StatCard label="Purchased (MTD)" value="420k" />
        <StatCard label="Used (MTD)" value={PLATFORM_KPIS.smsUsedThisMonth.toLocaleString()} />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Usage</span>
          <span>{usedPct}% used</span>
        </div>
        <Progress value={usedPct} className="mt-2 h-2" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Top companies</h2></div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Company</TableHead>
              <TableHead>SMS used</TableHead>
              <TableHead>Parcels today</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.smsUsed.toLocaleString()}</TableCell>
                <TableCell>{c.parcelsToday}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" className="rounded-lg">Configure SMS providers</Button>
    </div>
  );
}

export function NotificationsSection() {
  const types = ["Broadcast", "Maintenance notices", "Feature releases", "System updates", "Company announcements"];
  return (
    <div>
      <AdminPageHeader title="Notifications" description="Send platform-wide communications" actions={<Button className="rounded-lg"><Send className="mr-2 h-4 w-4" /> Send broadcast</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <button key={t} type="button" className="rounded-xl border border-border bg-card p-5 text-left shadow-card transition-colors hover:border-primary/30">
            <Megaphone className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">{t}</p>
            <p className="mt-1 text-xs text-muted-foreground">Compose and send to selected companies</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SupportSection() {
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Support Center" description="Tickets, live chat and feature requests" />
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Open tickets", "12"],
          ["Feature requests", "8"],
          ["Bug reports", "3"],
          ["Live chat", "2"],
        ].map(([l, v]) => <StatCard key={l} label={l} value={v} />)}
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
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {TICKETS.map((t) => (
              <TableRow key={t.id}>
                <TableCell><p className="font-medium">{t.subject}</p><p className="text-xs text-muted-foreground">{t.id}</p></TableCell>
                <TableCell>{t.company}</TableCell>
                <TableCell>{t.priority}</TableCell>
                <TableCell className="text-muted-foreground">{t.age}</TableCell>
                <TableCell><StatusPill status={t.status} /></TableCell>
                <TableCell><Button size="sm" variant="outline" className="rounded-lg">Assign</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function AnalyticsSection() {
  const charts = [
    { title: "Revenue", data: PLATFORM_CHARTS.revenue },
    { title: "Companies", data: PLATFORM_CHARTS.companyGrowth },
    { title: "Parcels", data: PLATFORM_CHARTS.parcels },
    { title: "SMS usage", data: PLATFORM_CHARTS.parcels.map((d) => ({ ...d, value: Math.round(d.value / 1000) })) },
  ];
  return (
    <div>
      <AdminPageHeader title="Analytics" description="Platform growth and usage metrics" />
      <div className="grid gap-5 lg:grid-cols-2">
        {charts.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold">{c.title}</h2>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeatureFlagsSection() {
  return (
    <div>
      <AdminPageHeader title="Feature flags" description="Enable or disable features globally" />
      <div className="rounded-xl border border-border bg-card shadow-card divide-y divide-border">
        {FEATURE_FLAGS.map((f) => (
          <div key={f.key} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.key}</p>
            </div>
            <Switch defaultChecked={f.enabled} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DomainsSection() {
  return (
    <div>
      <AdminPageHeader title="Domains" description="Subdomains and custom domains" />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Company</TableHead>
              <TableHead>Subdomain</TableHead>
              <TableHead>Custom domain</TableHead>
              <TableHead>SSL</TableHead>
              <TableHead>Verified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PLATFORM_DOMAINS.map((d) => (
              <TableRow key={d.company}>
                <TableCell className="font-medium">{d.company}</TableCell>
                <TableCell className="text-primary">{d.subdomain}</TableCell>
                <TableCell className="text-muted-foreground">{d.custom ?? "—"}</TableCell>
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
  const k = PLATFORM_OVERVIEW;
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Storage" description="Platform and company storage usage" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Platform storage" value={k.storageUsed} />
        <StatCard label="Limit" value={k.storageLimit} />
        <StatCard label="File count" value="842k" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="text-sm font-semibold">Usage trend</h2>
        <div className="mt-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={PLATFORM_CHARTS.revenue.map((d, i) => ({ month: d.month, value: 800 + i * 80 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.12} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
            {PLATFORM_COMPANIES.slice(0, 5).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.storage}</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  return (
    <div>
      <AdminPageHeader title="Integrations" description="Connected services and API keys" actions={<Button variant="outline" className="rounded-lg">Manage API keys</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((i) => (
          <div key={i.name} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{i.name}</p>
                <p className="text-xs text-muted-foreground">{i.type}</p>
              </div>
              <StatusPill status={i.status} />
            </div>
            <Button size="sm" variant="outline" className="mt-4 w-full rounded-lg">Configure</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlatformSettingsSection() {
  return (
    <div>
      <AdminPageHeader title="Platform settings" description="Global ParcelOS configuration" />
      <div className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        {[
          ["Platform name", "ParcelOS"],
          ["Platform email", "hello@mthunzi.tech"],
          ["Support email", "support@mthunzi.tech"],
          ["Default currency", "USD"],
        ].map(([label, val]) => (
          <div key={label} className="space-y-2">
            <Label>{label}</Label>
            <Input defaultValue={val} className="h-11 rounded-lg" />
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <div><p className="font-medium">Maintenance mode</p><p className="text-xs text-muted-foreground">Disable company workspaces temporarily</p></div>
          <Switch />
        </div>
        <Button className="rounded-lg">Save changes</Button>
      </div>
    </div>
  );
}

export function AuditLogsSection() {
  return (
    <div>
      <AdminPageHeader title="Audit logs" description="Searchable record of platform actions" />
      <div className="mb-4">
        <Input placeholder="Search actions, targets, actors…" className="h-10 max-w-md rounded-lg" />
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
            {AUDIT_LOGS.map((l) => (
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
  const logs = [
    { level: "INFO", msg: "Background job completed: invoice_generation", when: "12:04:22" },
    { level: "WARN", msg: "SMS provider rate limit approaching", when: "11:58:01" },
    { level: "INFO", msg: "New company provisioned: platinum-courier", when: "10:22:18" },
    { level: "ERROR", msg: "Payment webhook retry failed (Kilimanjaro Post)", when: "09:14:55" },
  ];
  return (
    <div>
      <AdminPageHeader title="System logs" description="Infrastructure and application logs" />
      <div className="rounded-xl border border-border bg-card font-mono text-xs shadow-card">
        {logs.map((l) => (
          <div key={l.when + l.msg} className="flex gap-4 border-b border-border px-4 py-3 last:border-0">
            <span className="text-muted-foreground">{l.when}</span>
            <span className={l.level === "ERROR" ? "text-destructive" : l.level === "WARN" ? "text-amber-600" : "text-emerald-600"}>{l.level}</span>
            <span className="flex-1">{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlatformUsersSection() {
  return (
    <div>
      <AdminPageHeader title="Platform users" description="MTHUNZI-TECH-LABS team members" actions={<Button className="rounded-lg"><Plus className="mr-2 h-4 w-4" /> Invite user</Button>} />
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
            {PLATFORM_USERS_LIST.map((u) => (
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
  return (
    <div>
      <AdminPageHeader title="Customers" description="End customers across all courier companies" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total customers" value="128,400" />
        <StatCard label="Active this month" value="42,800" />
        <StatCard label="New registrations" value="1,240" />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">Customer records are managed per company workspace. Use company detail to drill down.</p>
    </div>
  );
}

export function AccountSection() {
  return (
    <div>
      <AdminPageHeader title="My account" description="Your platform admin profile" />
      <div className="max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="space-y-2"><Label>Full name</Label><Input defaultValue="Admin User" className="h-11 rounded-lg" /></div>
        <div className="space-y-2"><Label>Email</Label><Input defaultValue="mthunzilabs@gmail.com" className="h-11 rounded-lg" /></div>
        <div className="space-y-2"><Label>Role</Label><Input defaultValue="Super Admin" disabled className="h-11 rounded-lg" /></div>
        <Button className="rounded-lg">Update profile</Button>
        <Button variant="outline" className="w-full rounded-lg">Change password</Button>
      </div>
    </div>
  );
}
