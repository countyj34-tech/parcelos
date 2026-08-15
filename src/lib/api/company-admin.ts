import { coordsForCity } from "@/lib/geo-zm";
import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

async function client() {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not available");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in required");
  return supabase;
}

/** Prefer staff/workspace RPCs — users.company_id is often still null for live staff. */
async function requireCompanyId(
  supabase: Awaited<ReturnType<typeof client>>,
  preferred?: string | null,
): Promise<string> {
  try {
    await supabase.rpc("repair_my_company_link");
  } catch {
    /* optional until migration 25 */
  }

  const { data: rpcId } = await supabase.rpc("get_my_company_id");
  if (typeof rpcId === "string" && /^[0-9a-f-]{36}$/i.test(rpcId)) return rpcId;
  if (preferred && /^[0-9a-f-]{36}$/i.test(preferred)) return preferred;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
  if (profile?.company_id) return profile.company_id as string;

  const { data: staff } = await supabase
    .from("staff")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (staff?.company_id) return staff.company_id as string;

  throw new Error("No company linked to your account. Sign out and sign in again.");
}

export async function createCompanyBranch(input: {
  name: string;
  code: string;
  city: string;
  phone?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  countryCode?: string;
}) {
  const supabase = await client();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const companyId = await requireCompanyId(supabase);

  const code = input.code.trim().toUpperCase() || input.name.slice(0, 3).toUpperCase();
  const city = input.city.trim() || "Lusaka";
  const fallback = coordsForCity(city);
  const lat = input.latitude ?? fallback?.lat ?? null;
  const lng = input.longitude ?? fallback?.lng ?? null;

  const { data, error } = await supabase
    .from("branches")
    .insert({
      company_id: companyId,
      name: input.name.trim(),
      code,
      city,
      country_code: input.countryCode ?? "ZM",
      phone: input.phone?.trim() || null,
      address_line1: input.address?.trim() || null,
      latitude: lat,
      longitude: lng,
      is_head_office: false,
      is_active: true,
      created_by: user!.id,
    })
    .select("id, name, code")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCompanyBranch(input: {
  id: string;
  name: string;
  code: string;
  city: string;
  phone?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const supabase = await client();
  const { error } = await supabase.rpc("update_company_branch", {
    p_id: input.id,
    p_name: input.name.trim(),
    p_code: input.code.trim() || null,
    p_city: input.city.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_address: input.address?.trim() || null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteCompanyBranch(branchId: string) {
  const supabase = await client();
  const { error } = await supabase.rpc("delete_company_branch", { p_id: branchId });
  if (!error) return;

  const codeSuffix = `-x${branchId.replace(/-/g, "").slice(0, 8)}`;
  const { data, error: upError } = await supabase
    .from("branches")
    .update({
      soft_delete: true,
      is_active: false,
      is_head_office: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", branchId)
    .eq("soft_delete", false)
    .select("id, code")
    .maybeSingle();

  if (data?.id) {
    if (data.code && !String(data.code).includes("-x")) {
      await supabase
        .from("branches")
        .update({ code: `${String(data.code).slice(0, 24)}${codeSuffix}` })
        .eq("id", branchId);
    }
    return;
  }

  throw new Error(upError?.message || error.message);
}

export async function setBranchActive(branchId: string, active: boolean) {
  const supabase = await client();
  const { error } = await supabase.from("branches").update({ is_active: active }).eq("id", branchId);
  if (error) throw new Error(error.message);
}

export async function createCompanyVehicle(input: {
  registration: string;
  make?: string;
  model?: string;
  capacityKg?: number;
  branchId?: string | null;
  companyId?: string | null;
}) {
  const supabase = await client();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const companyId = await requireCompanyId(supabase, input.companyId);

  const payload = {
    p_registration: input.registration.trim().toUpperCase(),
    p_make: input.make?.trim() || null,
    p_model: input.model?.trim() || null,
    p_capacity_kg: input.capacityKg ?? 50,
    p_branch_id: input.branchId || null,
  };

  const { data: rpcId, error: rpcError } = await supabase.rpc("create_company_vehicle", payload);
  if (!rpcError && rpcId) return { id: rpcId as string };
  if (rpcError && rpcError.code !== "PGRST202" && !/function .*create_company_vehicle/i.test(rpcError.message)) {
    throw new Error(rpcError.message);
  }

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      company_id: companyId,
      registration_no: payload.p_registration,
      make: payload.p_make,
      model: payload.p_model,
      capacity_kg: payload.p_capacity_kg,
      branch_id: payload.p_branch_id,
      is_active: true,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function setVehicleActive(vehicleId: string, active: boolean) {
  const supabase = await client();
  const { error } = await supabase.from("vehicles").update({ is_active: active }).eq("id", vehicleId);
  if (error) throw new Error(error.message);
}

export async function provisionStaff(input: {
  email: string;
  password: string;
  fullName: string;
  roleCode: string;
  phone?: string;
  branchId?: string | null;
}) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("provision_company_staff", {
    p_email: input.email.trim(),
    p_password: input.password,
    p_full_name: input.fullName.trim(),
    p_role_code: input.roleCode,
    p_phone: input.phone?.trim() || null,
    p_branch_id: input.branchId || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function createStaffInvite(input: {
  email: string;
  fullName: string;
  roleCode: string;
  phone?: string;
  branchId?: string | null;
}) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("create_staff_invite", {
    p_email: input.email.trim(),
    p_full_name: input.fullName.trim(),
    p_role_code: input.roleCode,
    p_phone: input.phone?.trim() || null,
    p_branch_id: input.branchId || null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row as { invite_id: string; token: string };
}

export async function setStaffActive(staffId: string, active: boolean) {
  const supabase = await client();
  const { error } = await supabase.rpc("set_staff_active", {
    p_staff_id: staffId,
    p_active: active,
  });
  if (error) throw new Error(error.message);
}

export async function assignStaffBranch(staffId: string, branchId: string) {
  const supabase = await client();
  const { error } = await supabase.rpc("assign_staff_branch", {
    p_staff_id: staffId,
    p_branch_id: branchId,
  });
  if (error) throw new Error(error.message);
}

export async function dispatchParcels(input: {
  parcelIds: string[];
  companyId: string;
  note?: string;
}) {
  const supabase = await client();
  if (!input.parcelIds.length) throw new Error("Select at least one parcel");

  const { error } = await supabase
    .from("parcels")
    .update({ status: "dispatched" })
    .in("id", input.parcelIds);

  if (error) throw new Error(error.message);

  const events = input.parcelIds.map((id) => ({
    company_id: input.companyId,
    parcel_id: id,
    status: "dispatched",
    title: "Dispatched",
    description: input.note || "Loaded onto vehicle and left origin branch.",
    occurred_at: new Date().toISOString(),
    is_public: true,
  }));

  await supabase.from("parcel_tracking").insert(events);
}

export async function listCompanyDrivers() {
  const supabase = await client();
  const { data, error } = await supabase.rpc("list_company_drivers");
  if (error) throw new Error(error.message);
  return (data ?? []).map((d: Record<string, unknown>) => ({
    id: String(d["id"] ?? ""),
    name: String(d["name"] ?? "Driver"),
    phone: (d["phone"] as string | null) ?? null,
    available: Boolean(d["available"]),
    licenseNumber: (d["license_number"] as string | null) ?? null,
    staffId: (d["staff_id"] as string | null) ?? null,
  }));
}

export async function ensureDriverProfile(staffId: string, license?: string) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("ensure_driver_profile", {
    p_staff_id: staffId,
    p_license: license ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not create driver profile");
  return data as string;
}

export async function createDispatchDriver(input: {
  name: string;
  phone?: string;
  license?: string;
}) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("create_dispatch_driver", {
    p_name: input.name.trim(),
    p_phone: input.phone?.trim() || null,
    p_license: input.license?.trim() || null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not add driver");
  return data as string;
}

export async function assignDriverToParcels(input: {
  parcelIds: string[];
  driverId: string;
  vehicleId?: string | null;
}) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("assign_driver_to_parcels", {
    p_parcel_ids: input.parcelIds,
    p_driver_id: input.driverId,
    p_vehicle_id: input.vehicleId ?? null,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function updateMessagingSettings(input: {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  smsSenderId?: string;
  whatsappNumber?: string;
  notifyOnReceive: boolean;
  notifyOnDispatch: boolean;
  notifyOnReady: boolean;
}) {
  const supabase = await client();
  const companyId = await requireCompanyId(supabase);

  const { error } = await supabase
    .from("company_settings")
    .update({
      sms_enabled: input.smsEnabled,
      whatsapp_enabled: input.whatsappEnabled,
      sms_sender_id: input.smsSenderId?.trim() || null,
      whatsapp_number: input.whatsappNumber?.trim() || null,
      notify_on_receive: input.notifyOnReceive,
      notify_on_dispatch: input.notifyOnDispatch,
      notify_on_ready: input.notifyOnReady,
    })
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
}

export async function fetchMessagingSettings() {
  const supabase = await client();
  let companyId: string;
  try {
    companyId = await requireCompanyId(supabase);
  } catch {
    return null;
  }

  const { data } = await supabase
    .from("company_settings")
    .select(
      "sms_enabled, whatsapp_enabled, sms_sender_id, whatsapp_number, notify_on_receive, notify_on_dispatch, notify_on_ready",
    )
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) return null;
  return {
    smsEnabled: data.sms_enabled !== false,
    whatsappEnabled: Boolean(data.whatsapp_enabled),
    smsSenderId: (data.sms_sender_id as string | null) ?? "",
    whatsappNumber: (data.whatsapp_number as string | null) ?? "",
    notifyOnReceive: data.notify_on_receive !== false,
    notifyOnDispatch: data.notify_on_dispatch !== false,
    notifyOnReady: data.notify_on_ready !== false,
  };
}

export const STAFF_ROLE_OPTIONS = [
  { code: "company_admin", label: "Company Admin" },
  { code: "branch_manager", label: "Branch Manager" },
  { code: "receptionist", label: "Receptionist" },
  { code: "dispatcher", label: "Dispatcher" },
  { code: "finance", label: "Finance" },
  { code: "customer_support", label: "Customer Support" },
  { code: "driver", label: "Driver (no login)" },
  { code: "auditor", label: "Auditor" },
] as const;

