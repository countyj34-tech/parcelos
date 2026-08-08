import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { money } from "@/lib/money";

export type PlatformPaymentRow = {
  id: string;
  company: string;
  amount: string;
  method: string;
  status: string;
  when: string;
  tracking: string | null;
};

export async function fetchPlatformPayments(): Promise<PlatformPaymentRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from("payments")
    .select(`
      id,
      amount_cents,
      currency_code,
      method_type,
      status,
      paid_at,
      companies(name),
      parcels(tracking_number)
    `)
    .eq("soft_delete", false)
    .order("paid_at", { ascending: false })
    .limit(50);

  if (error || !data) {
    console.warn("[fetchPlatformPayments]", error?.message);
    return [];
  }

  return data.map((row) => {
    const company = row.companies as { name: string } | null;
    const parcel = row.parcels as { tracking_number: string } | null;
    return {
      id: row.id as string,
      company: company?.name ?? "—",
      amount: money(Math.round(Number(row.amount_cents) / 100), String(row.currency_code || "ZMW")),
      method: String(row.method_type).replace(/_/g, " "),
      status: String(row.status),
      when: new Date(String(row.paid_at)).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      tracking: parcel?.tracking_number ?? null,
    };
  });
}
