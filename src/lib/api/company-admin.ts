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

export async function createCompanyBranch(input: {
  name: string;
  code: string;
  city: string;
  phone?: string;
  countryCode?: string;
}) {
  const supabase = await client();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user!.id).maybeSingle();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) throw new Error("No company linked to your account");

  const code = input.code.trim().toUpperCase() || input.name.slice(0, 3).toUpperCase();

  const { data, error } = await supabase
    .from("branches")
    .insert({
      company_id: companyId,
      name: input.name.trim(),
      code,
      city: input.city.trim() || "Lusaka",
      country_code: input.countryCode ?? "ZM",
      phone: input.phone?.trim() || null,
      is_head_office: false,
      is_active: true,
      created_by: user!.id,
    })
    .select("id, name, code")
    .single();

  if (error) throw new Error(error.message);
  return data;
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
}) {
  const supabase = await client();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user!.id).maybeSingle();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) throw new Error("No company linked to your account");

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      company_id: companyId,
      registration_no: input.registration.trim().toUpperCase(),
      make: input.make?.trim() || null,
      model: input.model?.trim() || null,
      capacity_kg: input.capacityKg ?? 50,
      branch_id: input.branchId || null,
      is_active: true,
      created_by: user!.id,
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
    id: d.id as string,
    name: d.name as string,
    phone: (d.phone as string | null) ?? null,
    available: Boolean(d.available),
    licenseNumber: (d.license_number as string | null) ?? null,
  }));
}

export async function ensureDriverProfile(staffId: string, license?: string) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("ensure_driver_profile", {
    p_staff_id: staffId,
    p_license: license ?? null,
  });
  if (error) throw new Error(error.message);
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user!.id).maybeSingle();
  if (!profile?.company_id) throw new Error("No company");

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
    .eq("company_id", profile.company_id);

  if (error) throw new Error(error.message);
}

export async function fetchMessagingSettings() {
  const supabase = await client();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user!.id).maybeSingle();
  if (!profile?.company_id) return null;

  const { data } = await supabase
    .from("company_settings")
    .select(
      "sms_enabled, whatsapp_enabled, sms_sender_id, whatsapp_number, notify_on_receive, notify_on_dispatch, notify_on_ready",
    )
    .eq("company_id", profile.company_id)
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
  { code: "driver", label: "Driver" },
  { code: "auditor", label: "Auditor" },
] as const;

