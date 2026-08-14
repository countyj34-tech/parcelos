import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { money } from "@/lib/money";

export type ConsoleChartPoint = { month: string; value: number };

export type ConsoleOverview = {
  activeCompanies: number;
  trialCompanies: number;
  expiredCompanies: number;
  suspendedCompanies: number;
  totalCompanies: number;
  monthlyRevenue: number;
  todayParcels: number;
  platformUsers: number;
  branches: number;
  storageUsed: string;
  storageLimit: string;
  smsRemaining: number;
  smsUsedMonth: number;
  apiRequests: string;
  customerTotal: number;
  charts: {
    revenue: ConsoleChartPoint[];
    companyGrowth: ConsoleChartPoint[];
    parcels: ConsoleChartPoint[];
    sms: ConsoleChartPoint[];
  };
  activity: Array<{ text: string; when: string }>;
};

export type ConsolePlan = {
  id: string;
  code: string;
  name: string;
  price: number;
  currency: string;
  branches: number;
  users: number;
  storage: string;
  sms: number;
  features: string[];
  active: boolean;
  companies: number;
  revenue: number;
};

export type ConsoleBundle = {
  plans: ConsolePlan[];
  customers: { total: number; activeMonth: number; new: number };
  platformUsers: Array<{ name: string; email: string; role: string; lastActive: string; active: boolean }>;
  domains: Array<{
    company: string;
    hostname: string;
    type: string;
    ssl: string;
    verified: boolean;
    primary: boolean;
  }>;
  sms: { usedMonth: number; total: number; top: Array<{ name: string; smsUsed: number; parcelsToday: number }> };
  tickets: Array<{
    id: string;
    subject: string;
    company: string;
    priority: string;
    status: string;
    age: string;
    type: string;
  }>;
  ticketStats: { open: number; feature: number; bug: number; chat: number };
  audit: Array<{ id: string; action: string; target: string; actor: string; when: string; description: string }>;
  systemLogs: Array<{ level: string; msg: string; when: string; source: string }>;
  storage: {
    bytes: number;
    files: number;
    companies: Array<{ name: string; bytes: number; images: number; documents: number }>;
  };
  flags: Array<{ key: string; label: string; enabled: boolean }>;
  saasPayments: Array<{
    id: string;
    txRef: string;
    amountMajor: number;
    amountPlatform: number;
    amountProvider: number;
    currencyCode: string;
    status: string;
    paymentPath: string;
    companyName: string;
    planName: string;
    months: number;
    updatedAt: string;
  }>;
  parcelPayments: Array<{
    id: string;
    company: string;
    amountCents: number;
    currency: string;
    method: string;
    status: string;
    paidAt: string;
    tracking: string | null;
  }>;
};

function asObject<T extends Record<string, unknown>>(data: unknown): T | null {
  if (data && typeof data === "object" && !Array.isArray(data)) return data as T;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as T;
    } catch {
      return null;
    }
  }
  return null;
}

export function formatStorageBytes(bytes: number | undefined | null): string {
  const n = Number(bytes ?? 0);
  if (!n) return "0 GB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} TB`;
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = args ? await supabase.rpc(name, args) : await supabase.rpc(name);
  if (error) {
    console.warn(`[platform-console] ${name}`, error.message);
    return null;
  }
  return data as T;
}

export async function fetchConsoleOverview(): Promise<ConsoleOverview | null> {
  const raw = await rpc<unknown>("platform_console_overview");
  const row = asObject<Record<string, unknown>>(raw);
  if (!row) return null;
  const charts = (row.charts ?? {}) as Record<string, ConsoleChartPoint[]>;
  const storageBytes = Number(row.storageBytes ?? 0);
  const limitGb = Number(row.storageLimitGb ?? 0);
  return {
    activeCompanies: Number(row.active ?? 0),
    trialCompanies: Number(row.trial ?? 0),
    expiredCompanies: Number(row.expired ?? 0),
    suspendedCompanies: Number(row.suspended ?? 0) + Number(row.paused ?? 0),
    totalCompanies: Number(row.total ?? 0),
    monthlyRevenue: Number(row.monthlyRevenue ?? 0),
    todayParcels: Number(row.todayParcels ?? 0),
    platformUsers: Number(row.platformUsers ?? 0),
    branches: Number(row.branches ?? 0),
    storageUsed: formatStorageBytes(storageBytes),
    storageLimit: limitGb ? `${limitGb} GB` : "—",
    smsRemaining: Number(row.smsRemaining ?? 0),
    smsUsedMonth: Number(row.smsUsedMonth ?? 0),
    apiRequests: "—",
    customerTotal: Number(row.customerTotal ?? 0),
    charts: {
      revenue: Array.isArray(charts.revenue) ? charts.revenue : [],
      companyGrowth: Array.isArray(charts.companyGrowth) ? charts.companyGrowth : [],
      parcels: Array.isArray(charts.parcels) ? charts.parcels : [],
      sms: Array.isArray(charts.sms) ? charts.sms : [],
    },
    activity: Array.isArray(row.activity) ? (row.activity as ConsoleOverview["activity"]) : [],
  };
}

export async function fetchConsoleBundle(): Promise<ConsoleBundle | null> {
  const raw = await rpc<unknown>("platform_console_bundle");
  const row = asObject<Record<string, unknown>>(raw);
  if (!row) return null;

  const plans = Array.isArray(row.plans)
    ? (row.plans as Array<Record<string, unknown>>).map((p) => ({
        id: String(p.id ?? p.code),
        code: String(p.code ?? ""),
        name: String(p.name ?? "Plan"),
        price: Number(p.price ?? 0),
        currency: String(p.currency ?? "ZMW"),
        branches: Number(p.branches ?? 0),
        users: Number(p.users ?? 0),
        storage: String(p.storage ?? "—"),
        sms: Number(p.sms ?? 0),
        features: Array.isArray(p.features)
          ? (p.features as unknown[]).map((f) => (typeof f === "string" ? f : JSON.stringify(f)))
          : [],
        active: Boolean(p.active),
        companies: Number(p.companies ?? 0),
        revenue: Number(p.revenue ?? 0),
      }))
    : [];

  const customers = (row.customers ?? {}) as Record<string, number>;
  const ticketStats = (row.ticketStats ?? {}) as Record<string, number>;
  const sms = (row.sms ?? {}) as Record<string, unknown>;
  const storage = (row.storage ?? {}) as Record<string, unknown>;

  return {
    plans,
    customers: {
      total: Number(customers.total ?? 0),
      activeMonth: Number(customers.activeMonth ?? 0),
      new: Number(customers.new ?? 0),
    },
    platformUsers: Array.isArray(row.platformUsers) ? (row.platformUsers as ConsoleBundle["platformUsers"]) : [],
    domains: Array.isArray(row.domains) ? (row.domains as ConsoleBundle["domains"]) : [],
    sms: {
      usedMonth: Number(sms.usedMonth ?? 0),
      total: Number(sms.total ?? 0),
      top: Array.isArray(sms.top) ? (sms.top as ConsoleBundle["sms"]["top"]) : [],
    },
    tickets: Array.isArray(row.tickets) ? (row.tickets as ConsoleBundle["tickets"]) : [],
    ticketStats: {
      open: Number(ticketStats.open ?? 0),
      feature: Number(ticketStats.feature ?? 0),
      bug: Number(ticketStats.bug ?? 0),
      chat: Number(ticketStats.chat ?? 0),
    },
    audit: Array.isArray(row.audit) ? (row.audit as ConsoleBundle["audit"]) : [],
    systemLogs: Array.isArray(row.systemLogs) ? (row.systemLogs as ConsoleBundle["systemLogs"]) : [],
    storage: {
      bytes: Number(storage.bytes ?? 0),
      files: Number(storage.files ?? 0),
      companies: Array.isArray(storage.companies)
        ? (storage.companies as ConsoleBundle["storage"]["companies"])
        : [],
    },
    flags: Array.isArray(row.flags) ? (row.flags as ConsoleBundle["flags"]) : [],
    saasPayments: Array.isArray(row.saasPayments) ? (row.saasPayments as ConsoleBundle["saasPayments"]) : [],
    parcelPayments: Array.isArray(row.parcelPayments)
      ? (row.parcelPayments as ConsoleBundle["parcelPayments"])
      : [],
  };
}

export async function setConsoleFlag(key: string, enabled: boolean): Promise<boolean> {
  const ok = await rpc<boolean>("platform_console_set_flag", { p_key: key, p_enabled: enabled });
  return Boolean(ok);
}

export async function updateConsolePlan(input: {
  code: string;
  priceMajor: number;
  maxBranches?: number | null;
  maxUsers?: number | null;
  maxStorageGb?: number | null;
  maxSmsMonthly?: number | null;
  isActive?: boolean;
  name?: string;
}): Promise<boolean> {
  const data = await rpc<unknown>("platform_console_update_plan", {
    p_code: input.code,
    p_price_major: input.priceMajor,
    p_max_branches: input.maxBranches ?? null,
    p_max_users: input.maxUsers ?? null,
    p_max_storage_gb: input.maxStorageGb ?? null,
    p_max_sms_monthly: input.maxSmsMonthly ?? null,
    p_is_active: input.isActive ?? null,
    p_name: input.name ?? null,
  });
  return Boolean(data);
}

export async function sendConsoleBroadcast(title: string, body: string): Promise<number> {
  const count = await rpc<number>("platform_console_broadcast", { p_title: title, p_body: body });
  return Number(count ?? 0);
}

export function mapParcelPayments(
  rows: ConsoleBundle["parcelPayments"],
): Array<{ id: string; company: string; amount: string; method: string; status: string; when: string; tracking: string | null }> {
  return rows.map((p) => ({
    id: p.id,
    company: p.company,
    amount: money(Math.round(Number(p.amountCents) / 100), p.currency || "ZMW"),
    method: String(p.method ?? "").replace(/_/g, " "),
    status: p.status,
    when: p.paidAt
      ? new Date(p.paidAt).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    tracking: p.tracking,
  }));
}
