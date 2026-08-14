import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type PlatformPaymentAccount = {
  id: string;
  kind: "mobile_money" | "bank";
  provider: string;
  label: string;
  accountName: string;
  accountNumber: string;
  bankBranch: string | null;
  sortCode: string | null;
  instructions: string | null;
  isActive: boolean;
  sortOrder: number;
  brandColor: string | null;
  iconKey: string | null;
};

export type BillingAddon = {
  id: string;
  code: string;
  kind: "sms_pack" | "whatsapp" | "sms_bulk";
  name: string;
  description: string | null;
  priceCents: number;
  providerCostCents: number;
  smsCredits: number;
  whatsappMonths: number;
};

export type CheckoutQuote = {
  planCode: string;
  planName: string;
  months: number;
  planSubtotalCents: number;
  addonsSubtotalCents: number;
  totalCents: number;
  amountMajor: number;
  amountPlatformCents: number;
  amountProviderCents: number;
  smsCredits: number;
  whatsappMonths: number;
  discountFactor: number;
  lineItems: Array<Record<string, unknown>>;
  currencyCode: string;
};

export type ManualPaymentStart = {
  intentId: string;
  txRef: string;
  amountMajor: number;
  currencyCode: string;
  planCode: string;
  planName: string;
  companyName: string;
  months: number;
  amountPlatform: number;
  amountProvider: number;
  smsCredits: number;
  whatsappMonths: number;
  lineItems: Array<Record<string, unknown>>;
};

export type PendingManualPayment = {
  id: string;
  txRef: string;
  amountMajor: number;
  currencyCode: string;
  status: string;
  companyId: string;
  companyName: string;
  planName: string;
  accountLabel: string | null;
  payerNote: string | null;
  claimedAt: string | null;
  createdAt: string;
  months: number;
  amountPlatform: number;
  amountProvider: number;
  smsCredits: number;
  whatsappMonths: number;
};

function mapAccount(row: Record<string, unknown>): PlatformPaymentAccount {
  return {
    id: row.id as string,
    kind: row.kind as PlatformPaymentAccount["kind"],
    provider: String(row.provider),
    label: String(row.label),
    accountName: String(row.account_name),
    accountNumber: String(row.account_number),
    bankBranch: (row.bank_branch as string | null) ?? null,
    sortCode: (row.sort_code as string | null) ?? null,
    instructions: (row.instructions as string | null) ?? null,
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order ?? 0),
    brandColor: (row.brand_color as string | null) ?? null,
    iconKey: (row.icon_key as string | null) ?? row.provider?.toString() ?? null,
  };
}

export async function listPlatformPaymentAccounts(): Promise<PlatformPaymentAccount[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_platform_payment_accounts");
  if (error) {
    console.warn("[listPlatformPaymentAccounts]", error.message);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => mapAccount(r));
}

export async function listBillingAddons(): Promise<BillingAddon[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_billing_addons");
  if (error) {
    console.warn("[listBillingAddons]", error.message);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    code: String(r.code),
    kind: r.kind as BillingAddon["kind"],
    name: String(r.name),
    description: (r.description as string | null) ?? null,
    priceCents: Number(r.price_cents ?? 0),
    providerCostCents: Number(r.provider_cost_cents ?? 0),
    smsCredits: Number(r.sms_credits ?? 0),
    whatsappMonths: Number(r.whatsapp_months ?? 0),
  }));
}

export async function quoteSaasCheckout(input: {
  planCode: string;
  months: number;
  addonCodes: string[];
}): Promise<CheckoutQuote | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("quote_saas_checkout", {
    p_plan_code: input.planCode,
    p_months: input.months,
    p_addon_codes: input.addonCodes,
  });
  if (error) {
    console.warn("[quoteSaasCheckout]", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    planCode: String(row.plan_code),
    planName: String(row.plan_name),
    months: Number(row.months),
    planSubtotalCents: Number(row.plan_subtotal_cents),
    addonsSubtotalCents: Number(row.addons_subtotal_cents),
    totalCents: Number(row.total_cents),
    amountMajor: Number(row.amount_major),
    amountPlatformCents: Number(row.amount_platform_cents),
    amountProviderCents: Number(row.amount_provider_cents),
    smsCredits: Number(row.sms_credits),
    whatsappMonths: Number(row.whatsapp_months),
    discountFactor: Number(row.discount_factor ?? 1),
    lineItems: (row.line_items as Array<Record<string, unknown>>) ?? [],
    currencyCode: String(row.currency_code ?? "ZMW"),
  };
}

export async function savePlatformPaymentAccount(input: {
  id?: string | null;
  kind: "mobile_money" | "bank";
  provider: string;
  label: string;
  accountName: string;
  accountNumber: string;
  bankBranch?: string;
  sortCode?: string;
  instructions?: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<PlatformPaymentAccount> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");
  // Console RPC works with logo-pattern Super Admin (anon); owner-gated upsert does not.
  const { data, error } = await supabase.rpc("platform_console_upsert_payment_account", {
    p_id: input.id ?? null,
    p_kind: input.kind,
    p_provider: input.provider,
    p_label: input.label,
    p_account_name: input.accountName,
    p_account_number: input.accountNumber,
    p_bank_branch: input.bankBranch ?? null,
    p_sort_code: input.sortCode ?? null,
    p_instructions: input.instructions ?? null,
    p_is_active: input.isActive ?? true,
    p_sort_order: input.sortOrder ?? 0,
  });
  if (error) throw new Error(error.message);
  return mapAccount(data as Record<string, unknown>);
}

export async function startManualSaasPayment(input: {
  planCode: string;
  accountId?: string | null;
  months: number;
  addonCodes: string[];
}): Promise<ManualPaymentStart> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("create_manual_saas_payment", {
    p_plan_code: input.planCode,
    p_account_id: input.accountId ?? null,
    p_months: input.months,
    p_addon_codes: input.addonCodes,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    intentId: row.intent_id as string,
    txRef: row.tx_ref as string,
    amountMajor: Number(row.amount_major),
    currencyCode: String(row.currency_code ?? "ZMW"),
    planCode: String(row.plan_code),
    planName: String(row.plan_name),
    companyName: String(row.company_name),
    months: Number(row.months ?? 1),
    amountPlatform: Number(row.amount_platform ?? 0),
    amountProvider: Number(row.amount_provider ?? 0),
    smsCredits: Number(row.sms_credits ?? 0),
    whatsappMonths: Number(row.whatsapp_months ?? 0),
    lineItems: (row.line_items as Array<Record<string, unknown>>) ?? [],
  };
}

export async function claimManualSaasPayment(txRef: string, accountId?: string | null, note?: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("claim_manual_saas_payment", {
    p_tx_ref: txRef,
    p_account_id: accountId ?? null,
    p_payer_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function listPendingManualPayments(): Promise<PendingManualPayment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("platform_console_list_pending_manual_payments");
  if (error) {
    console.warn("[listPendingManualPayments]", error.message);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    txRef: r.tx_ref as string,
    amountMajor: Number(r.amount_major),
    currencyCode: String(r.currency_code ?? "ZMW"),
    status: String(r.status),
    companyId: r.company_id as string,
    companyName: String(r.company_name),
    planName: String(r.plan_name),
    accountLabel: (r.account_label as string | null) ?? null,
    payerNote: (r.payer_note as string | null) ?? null,
    claimedAt: (r.claimed_at as string | null) ?? null,
    createdAt: r.created_at as string,
    months: Number(r.months ?? 1),
    amountPlatform: Number(r.amount_platform ?? 0),
    amountProvider: Number(r.amount_provider ?? 0),
    smsCredits: Number(r.sms_credits ?? 0),
    whatsappMonths: Number(r.whatsapp_months ?? 0),
  }));
}

export async function confirmManualSaasPayment(txRef: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("platform_console_confirm_manual_payment", {
    p_tx_ref: txRef,
  });
  if (error) throw new Error(error.message);
}

export type SaasRevenueDashboard = {
  revenueToday: number;
  revenueMonth: number;
  revenueAllTime: number;
  platformToday: number;
  platformMonth: number;
  platformAllTime: number;
  providerMonth: number;
  successCountMonth: number;
  pendingManualCount: number;
  activePaidCompanies: number;
};

export type RecentSaasPayment = {
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
  method: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchSaasRevenueDashboard(): Promise<SaasRevenueDashboard | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_saas_revenue_dashboard");
  if (error) {
    console.warn("[fetchSaasRevenueDashboard]", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    revenueToday: Number(row.revenue_today ?? 0),
    revenueMonth: Number(row.revenue_month ?? 0),
    revenueAllTime: Number(row.revenue_all_time ?? 0),
    platformToday: Number(row.platform_today ?? 0),
    platformMonth: Number(row.platform_month ?? 0),
    platformAllTime: Number(row.platform_all_time ?? 0),
    providerMonth: Number(row.provider_month ?? 0),
    successCountMonth: Number(row.success_count_month ?? 0),
    pendingManualCount: Number(row.pending_manual_count ?? 0),
    activePaidCompanies: Number(row.active_paid_companies ?? 0),
  };
}

export async function listRecentSaasPayments(limit = 40): Promise<RecentSaasPayment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_recent_saas_payments", { p_limit: limit });
  if (error) {
    console.warn("[listRecentSaasPayments]", error.message);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    txRef: String(r.tx_ref),
    amountMajor: Number(r.amount_major ?? 0),
    amountPlatform: Number(r.amount_platform ?? 0),
    amountProvider: Number(r.amount_provider ?? 0),
    currencyCode: String(r.currency_code ?? "ZMW"),
    status: String(r.status),
    paymentPath: String(r.payment_path ?? ""),
    companyName: String(r.company_name),
    planName: String(r.plan_name),
    months: Number(r.months ?? 1),
    method: (r.method as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}
