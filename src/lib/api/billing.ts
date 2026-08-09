import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type CompanyBillingState = {
  companyId: string;
  companyStatus: string;
  trialEndsAt: string | null;
  daysLeft: number | null;
  locked: boolean;
  planCode: string | null;
  planName: string | null;
  planPriceCents: number | null;
  currencyCode: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
};

export type GenesysCheckoutPayload = {
  mode: "hosted" | "direct";
  checkout_url?: string;
  fields?: Record<string, string>;
  tx_ref: string;
  amount?: number | string;
  currency?: string;
  plan_name?: string;
  message?: string;
  transaction_id?: string;
  error?: string;
};

export async function fetchCompanyBilling(): Promise<CompanyBillingState | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_company_billing_state");
  if (error) {
    console.warn("[fetchCompanyBilling]", error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    companyId: row.company_id as string,
    companyStatus: String(row.company_status ?? ""),
    trialEndsAt: (row.trial_ends_at as string | null) ?? null,
    daysLeft: row.days_left == null ? null : Number(row.days_left),
    locked: Boolean(row.locked),
    planCode: (row.plan_code as string | null) ?? null,
    planName: (row.plan_name as string | null) ?? null,
    planPriceCents: row.plan_price_cents == null ? null : Number(row.plan_price_cents),
    currencyCode: (row.currency_code as string | null) ?? "ZMW",
    subscriptionStatus: (row.subscription_status as string | null) ?? null,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
  };
}

/** Start GenesysPay checkout (hosted MoMo page) or direct phone prompt. Auto-unlocks via webhook. */
export async function startGenesysCheckout(input: {
  planCode?: string;
  months?: number;
  addonCodes?: string[];
  mode?: "hosted" | "direct";
  method?: "airtel" | "mtn" | "zamtel";
  phoneNumber?: string;
}): Promise<GenesysCheckoutPayload> {
  const supabase = getSupabase();
  if (!supabase) return { mode: "hosted", tx_ref: "", error: "Supabase not configured" };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { mode: "hosted", tx_ref: "", error: "Sign in required" };

  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return { mode: "hosted", tx_ref: "", error: "Missing VITE_SUPABASE_URL" };

  const res = await fetch(`${base}/functions/v1/create-genesyspay-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({
      plan_code: input.planCode ?? "starter",
      months: input.months ?? 1,
      addon_codes: input.addonCodes ?? [],
      mode: input.mode ?? "hosted",
      method: input.method,
      phone_number: input.phoneNumber,
    }),
  });

  const json = (await res.json()) as GenesysCheckoutPayload & { error?: string };
  if (!res.ok) return { mode: "hosted", tx_ref: "", error: json.error ?? "Checkout failed" };
  return json;
}

/** Submit hosted checkout form to GenesysPay (leaves the page). */
export function submitGenesysHostedCheckout(payload: GenesysCheckoutPayload) {
  if (!payload.checkout_url || !payload.fields) {
    throw new Error("Invalid hosted checkout payload");
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = payload.checkout_url;
  form.style.display = "none";
  for (const [name, value] of Object.entries(payload.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value ?? "";
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function formatPlanPrice(cents: number | null | undefined, currency = "ZMW") {
  if (cents == null) return "—";
  const major = cents / 100;
  try {
    return new Intl.NumberFormat(currency === "ZMW" ? "en-ZM" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "ZMW" ? 0 : 2,
    }).format(major);
  } catch {
    return currency === "ZMW" ? `K${major.toFixed(0)}` : `${currency} ${major.toFixed(0)}`;
  }
}
