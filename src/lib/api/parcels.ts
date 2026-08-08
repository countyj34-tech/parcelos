import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapDbParcelToUi, type DbParcelRow } from "@/lib/api/mappers";
import { PARCELS, type Parcel } from "@/lib/mock-data";

const PARCEL_SELECT = `
  id,
  tracking_number,
  sender_name,
  sender_phone,
  receiver_name,
  receiver_phone,
  status,
  payment_status,
  shipping_amount_cents,
  weight_kg,
  declared_value_cents,
  created_at,
  origin:branches!parcels_origin_branch_id_fkey(name),
  destination:branches!parcels_destination_branch_id_fkey(name),
  category:parcel_categories(name)
`;

export type ParcelFilters = {
  status?: string;
  branch?: string;
  payment?: string;
  search?: string;
};

export async function fetchParcels(filters: ParcelFilters = {}): Promise<Parcel[]> {
  if (!isSupabaseConfigured()) return filterMockParcels(filters);

  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  let query = supabase
    .from("parcels")
    .select(PARCEL_SELECT)
    .eq("soft_delete", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.search) {
    query = query.or(
      `tracking_number.ilike.%${filters.search}%,sender_name.ilike.%${filters.search}%,receiver_name.ilike.%${filters.search}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[fetchParcels]", error.message);
    return [];
  }

  if (!data?.length) return [];

  const mapped = (data as unknown as DbParcelRow[]).map(mapDbParcelToUi);
  return applyClientFilters(mapped, filters);
}

function filterMockParcels(filters: ParcelFilters): Parcel[] {
  return applyClientFilters(PARCELS, filters);
}

function applyClientFilters(parcels: Parcel[], filters: ParcelFilters): Parcel[] {
  return parcels.filter(
    (p) =>
      (!filters.status || filters.status === "all" || p.status === filters.status) &&
      (!filters.branch || filters.branch === "all" || p.branch === filters.branch) &&
      (!filters.payment || filters.payment === "all" || p.payment === filters.payment) &&
      (!filters.search ||
        [p.tracking, p.sender, p.receiver, p.destination]
          .join(" ")
          .toLowerCase()
          .includes(filters.search.toLowerCase())),
  );
}

export async function fetchParcelByTracking(tracking: string): Promise<Parcel | null> {
  if (!isSupabaseConfigured()) {
    return PARCELS.find((p) => p.tracking === tracking) ?? null;
  }

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("parcels")
    .select(PARCEL_SELECT)
    .eq("tracking_number", tracking.trim().toUpperCase())
    .eq("soft_delete", false)
    .maybeSingle();

  if (error || !data) return null;
  return mapDbParcelToUi(data as unknown as DbParcelRow);
}

export type ReceptionSearchMode = "phone" | "reference" | "tracking";

/** Reception desk lookup — real DB only when Supabase is configured. */
export async function searchReceptionParcels(
  mode: ReceptionSearchMode,
  query: string,
): Promise<Parcel[]> {
  const q = query.trim();
  if (!q) return [];

  if (!isSupabaseConfigured()) {
    return PARCELS.filter((p) => {
      if (mode === "phone") return p.senderPhone.includes(q) || p.receiverPhone.includes(q);
      return p.tracking.toLowerCase().includes(q.toLowerCase());
    }).slice(0, 10);
  }

  const supabase = getSupabase();
  if (!supabase) return [];

  let req = supabase.from("parcels").select(PARCEL_SELECT).eq("soft_delete", false).limit(20);

  if (mode === "phone") {
    const digits = q.replace(/\s+/g, "");
    req = req.or(`sender_phone.ilike.%${digits}%,receiver_phone.ilike.%${digits}%`);
  } else {
    req = req.ilike("tracking_number", `%${q.toUpperCase()}%`);
  }

  const { data, error } = await req.order("created_at", { ascending: false });
  if (error || !data) {
    console.warn("[searchReceptionParcels]", error?.message);
    return [];
  }
  return (data as unknown as DbParcelRow[]).map(mapDbParcelToUi);
}

export type FinalizeReceptionInput = {
  parcelId: string;
  companyId: string;
  feeMajor: number;
  currencyCode?: string;
  methodType: "cash" | "card" | "bank_transfer" | "mobile_money";
  weightKg?: number | null;
};

/** Set fee, mark paid, move parcel to received. */
export async function finalizeReceptionPayment(
  input: FinalizeReceptionInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: true };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not available" };

  const cents = Math.round(input.feeMajor * 100);

  const { error: parcelError } = await supabase
    .from("parcels")
    .update({
      shipping_amount_cents: cents,
      payment_status: "paid",
      status: "received",
      weight_kg: input.weightKg ?? undefined,
      received_at: new Date().toISOString(),
    })
    .eq("id", input.parcelId);

  if (parcelError) return { ok: false, error: parcelError.message };

  const { error: payError } = await supabase.from("payments").insert({
    company_id: input.companyId,
    parcel_id: input.parcelId,
    method_type: input.methodType,
    amount_cents: cents,
    currency_code: input.currencyCode ?? "ZMW",
    status: "completed",
    reference: `RCP-${Date.now()}`,
  });

  if (payError) {
    console.warn("[finalizeReceptionPayment] payment row:", payError.message);
    // Parcel already updated — still treat as success for counter flow
  }

  return { ok: true };
}

export async function fetchParcelTrackingEvents(tracking: string) {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: parcel } = await supabase
    .from("parcels")
    .select("id")
    .eq("tracking_number", tracking)
    .maybeSingle();

  if (!parcel) return [];

  const { data } = await supabase
    .from("parcel_tracking")
    .select("title, description, occurred_at, status")
    .eq("parcel_id", parcel.id)
    .eq("is_public", true)
    .order("occurred_at", { ascending: true });

  return data ?? [];
}

export type TrackParcelResult = {
  tracking_number: string;
  status: string;
  payment_status: string;
  sender_name: string;
  receiver_name: string;
  company_name: string;
  company_slug: string;
  origin_branch: string | null;
  destination_branch: string | null;
  updated_at: string;
};

export async function trackParcelPublic(tracking: string): Promise<TrackParcelResult | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("track_parcel_public", {
    p_tracking: tracking.trim().toUpperCase(),
  });

  if (error) {
    console.warn("[trackParcelPublic]", error.message);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as TrackParcelResult | undefined;
  return row?.tracking_number ? row : null;
}

export type CreateGuestParcelInput = {
  companyId: string;
  senderName: string;
  senderPhone: string;
  senderEmail?: string | null;
  receiverName: string;
  receiverPhone: string;
  originBranchId: string;
  destinationBranchId: string;
  description: string;
  currencyCode?: string;
  declaredValueCents?: number;
  categoryId?: string | null;
  weightKg?: number | null;
  instructions?: string | null;
};

export async function createGuestParcel(input: CreateGuestParcelInput): Promise<{
  trackingNumber: string;
  id: string;
} | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const suffix = Math.floor(100000 + Math.random() * 900000);
  const trackingNumber = `POS-${suffix}-ZM`;

  const { data, error } = await supabase
    .from("parcels")
    .insert({
      company_id: input.companyId,
      tracking_number: trackingNumber,
      sender_name: input.senderName,
      sender_phone: input.senderPhone,
      sender_email: input.senderEmail || null,
      receiver_name: input.receiverName,
      receiver_phone: input.receiverPhone,
      origin_branch_id: input.originBranchId,
      destination_branch_id: input.destinationBranchId,
      current_branch_id: input.originBranchId,
      status: "waiting_for_dropoff",
      payment_status: "unpaid",
      shipping_amount_cents: 0,
      currency_code: input.currencyCode ?? "ZMW",
      description: input.description,
      declared_value_cents: input.declaredValueCents ?? 0,
      category_id: input.categoryId ?? null,
      weight_kg: input.weightKg ?? null,
      metadata: input.instructions ? { instructions: input.instructions } : {},
    })
    .select("id, tracking_number")
    .single();

  if (error || !data) {
    console.warn("[createGuestParcel]", error?.message);
    return null;
  }

  return { id: data.id as string, trackingNumber: data.tracking_number as string };
}

export async function listCompanyBranches(
  companyId: string,
): Promise<Array<{ id: string; name: string; code: string }>> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("branches")
    .select("id, name, code")
    .eq("company_id", companyId)
    .eq("soft_delete", false)
    .eq("is_active", true)
    .order("is_head_office", { ascending: false })
    .order("name");

  if (error || !data) return [];
  return data as Array<{ id: string; name: string; code: string }>;
}
