import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapDbParcelToUi, type DbParcelRow } from "@/lib/api/mappers";
import { UI_PAYMENT_TO_DB, UI_STATUS_TO_DB, type Parcel, type ParcelStatus } from "@/lib/types/parcel";

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
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();
  if (!supabase) return [];

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  let query = supabase
    .from("parcels")
    .select(PARCEL_SELECT)
    .eq("soft_delete", false)
    .order("created_at", { ascending: false })
    .limit(150);

  if (filters.search?.trim()) {
    const s = filters.search.trim();
    query = query.or(
      `tracking_number.ilike.%${s}%,sender_name.ilike.%${s}%,receiver_name.ilike.%${s}%,sender_phone.ilike.%${s}%`,
    );
  }

  if (filters.status && filters.status !== "all") {
    const codes = UI_STATUS_TO_DB[filters.status as ParcelStatus];
    if (codes?.length) query = query.in("status", codes);
  }

  if (filters.payment && filters.payment !== "all") {
    const code = UI_PAYMENT_TO_DB[filters.payment as Parcel["payment"]];
    if (code) query = query.eq("payment_status", code);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[fetchParcels]", error.message);
    return [];
  }

  if (!data?.length) return [];

  const mapped = (data as unknown as DbParcelRow[]).map(mapDbParcelToUi);
  if (!filters.branch || filters.branch === "all") return mapped;
  return mapped.filter((p) => p.branch === filters.branch || p.origin === filters.branch);
}

export async function fetchParcelByTracking(tracking: string): Promise<Parcel | null> {
  if (!isSupabaseConfigured()) return null;

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

  if (!isSupabaseConfigured()) return [];

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

  await supabase.from("parcel_tracking").insert({
    company_id: input.companyId,
    parcel_id: input.parcelId,
    status: "received",
    title: "Received",
    description: "Verified and paid at the counter.",
    occurred_at: new Date().toISOString(),
    is_public: true,
  });

  const { data: parcelRow } = await supabase
    .from("parcels")
    .select("tracking_number, sender_phone, receiver_phone")
    .eq("id", input.parcelId)
    .maybeSingle();

  if (parcelRow) {
    const { notifyParcelStakeholders } = await import("@/lib/api/messaging");
    const msg = `Parcel ${parcelRow.tracking_number} received at counter. Track updates in your portal.`;
    for (const phone of [parcelRow.sender_phone, parcelRow.receiver_phone]) {
      if (!phone) continue;
      void notifyParcelStakeholders({
        companyId: input.companyId,
        parcelId: input.parcelId,
        event: "receive",
        phone,
        message: msg,
      });
    }
  }

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
  /** Customer-facing destination (province / area) — stored in parcel metadata instructions. */
  destinationProvince?: string | null;
};

export async function createGuestParcel(input: CreateGuestParcelInput): Promise<{
  trackingNumber: string;
  id: string;
} | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "App is not connected to the database" };
  const supabase = getSupabase();
  if (!supabase) return { error: "App is not connected to the database" };

  if (!/^[0-9a-f-]{36}$/i.test(input.companyId)) {
    return { error: "Open the company share link again (/c/your-company) before sending." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.originBranchId) || !/^[0-9a-f-]{36}$/i.test(input.destinationBranchId)) {
    return { error: "Choose a destination province so we can route this parcel." };
  }

  const province = input.destinationProvince?.trim();
  const instructions = [input.instructions?.trim(), province ? `Destination province: ${province}` : ""]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await supabase.rpc("register_guest_parcel", {
    p_company_id: input.companyId,
    p_sender_name: input.senderName,
    p_sender_phone: input.senderPhone,
    p_receiver_name: input.receiverName,
    p_receiver_phone: input.receiverPhone,
    p_origin_branch_id: input.originBranchId,
    p_destination_branch_id: input.destinationBranchId,
    p_sender_email: input.senderEmail || null,
    p_description: input.description || null,
    p_instructions: instructions || null,
    p_declared_value_cents: input.declaredValueCents ?? 0,
    p_category_id: input.categoryId ?? null,
    p_weight_kg: input.weightKg ?? null,
    p_currency_code: input.currencyCode ?? "ZMW",
  });

  if (error) {
    console.warn("[createGuestParcel]", error.message);
    // Fallback for DBs that have not applied guest RPC yet
    const legacy = await createGuestParcelLegacy(input);
    if (legacy && "id" in legacy) return legacy;
    return { error: error.message || "Could not register parcel" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id || !row?.tracking_number) {
    return { error: "Registration returned no tracking number" };
  }
  return { id: row.id as string, trackingNumber: row.tracking_number as string };
}

async function createGuestParcelLegacy(input: CreateGuestParcelInput): Promise<{
  trackingNumber: string;
  id: string;
} | { error: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const suffix = Math.floor(100000 + Math.random() * 900000);
  const trackingNumber = `POS-${suffix}-ZM`;
  const province = input.destinationProvince?.trim();
  const instructions = [input.instructions?.trim(), province ? `Destination province: ${province}` : ""]
    .filter(Boolean)
    .join("\n");

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
      metadata: instructions ? { instructions, ...(province ? { destination_province: province } : {}) } : {},
    })
    .select("id, tracking_number")
    .single();

  if (error || !data) {
    console.warn("[createGuestParcelLegacy]", error?.message);
    return error ? { error: error.message } : null;
  }

  const phone = input.senderPhone.trim();
  if (phone) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("phone", phone)
      .eq("soft_delete", false)
      .maybeSingle();

    if (!existing) {
      await supabase.from("customers").insert({
        company_id: input.companyId,
        full_name: input.senderName,
        phone,
        email: input.senderEmail || null,
        is_guest: true,
      });
    }
  }

  await supabase.from("parcel_tracking").insert({
    company_id: input.companyId,
    parcel_id: data.id,
    status: "waiting_for_dropoff",
    title: "Waiting for Drop-off",
    description: "Parcel registered — bring it to the branch for weighing and payment.",
    occurred_at: new Date().toISOString(),
    is_public: true,
  });

  return { id: data.id as string, trackingNumber: data.tracking_number as string };
}

export async function listCompanyBranches(
  companyId: string,
): Promise<Array<{ id: string; name: string; code: string }>> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  // Prefer SECURITY DEFINER RPC so anonymous customers on share links can load branches
  const { data: rpcRows, error: rpcError } = await supabase.rpc("list_company_branches_public", {
    p_company_id: companyId,
  });
  if (!rpcError && Array.isArray(rpcRows) && rpcRows.length) {
    return rpcRows.map((b) => ({
      id: String((b as { id: string }).id),
      name: String((b as { name: string }).name),
      code: String((b as { code: string }).code ?? ""),
    }));
  }

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

export const DEFAULT_PARCEL_CATEGORIES = [
  "Documents",
  "Electronics",
  "Clothing & Textiles",
  "Auto Spares",
  "Groceries & Perishables",
  "Medical Supplies",
  "Fragile Goods",
  "General",
] as const;

export function fallbackParcelCategories(): Array<{ id: string; name: string }> {
  return DEFAULT_PARCEL_CATEGORIES.map((name) => ({ id: `name:${name}`, name }));
}

function mergeCategoryLists(
  remote: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
  const byName = new Map<string, { id: string; name: string }>();
  for (const row of fallbackParcelCategories()) {
    byName.set(row.name.toLowerCase(), row);
  }
  for (const row of remote) {
    const name = row.name.trim();
    if (!name) continue;
    byName.set(name.toLowerCase(), { id: row.id, name });
  }
  return Array.from(byName.values());
}

export async function listCompanyCategories(
  companyId: string,
): Promise<Array<{ id: string; name: string }>> {
  const fallback = fallbackParcelCategories();
  if (!isSupabaseConfigured()) return fallback;
  const supabase = getSupabase();
  if (!supabase) return fallback;

  const { data: rpcRows, error: rpcError } = await supabase.rpc("list_company_categories_public", {
    p_company_id: companyId,
  });
  if (rpcError) {
    console.warn("[listCompanyCategories]", rpcError.message);
  } else if (Array.isArray(rpcRows) && rpcRows.length) {
    return mergeCategoryLists(
      rpcRows.map((c) => ({
        id: String((c as { id: string }).id),
        name: String((c as { name: string }).name),
      })),
    );
  }

  const { data, error } = await supabase
    .from("parcel_categories")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("soft_delete", false)
    .order("sort_order")
    .order("name");

  if (error) {
    console.warn("[listCompanyCategories table]", error.message);
    return fallback;
  }
  return mergeCategoryLists((data ?? []) as Array<{ id: string; name: string }>);
}

export async function resolveParcelCategory(
  companyId: string,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed || !isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("resolve_parcel_category", {
    p_company_id: companyId,
    p_name: trimmed,
  });
  if (error) {
    console.warn("[resolveParcelCategory]", error.message);
    return null;
  }
  return typeof data === "string" && data ? data : null;
}

/** Customer portal history — RLS returns sender/receiver parcels for the signed-in customer. */
export async function fetchMyPortalParcels(): Promise<Parcel[]> {
  return fetchParcels();
}
