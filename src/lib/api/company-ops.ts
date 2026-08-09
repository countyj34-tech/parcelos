import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapDbParcelToUi, type DbParcelRow } from "@/lib/api/mappers";
import { money } from "@/lib/money";
import type { Parcel } from "@/lib/types/parcel";

export type CompanyBranch = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  phone: string | null;
  isHeadOffice: boolean;
  isActive: boolean;
  parcelsToday: number;
  revenueToday: number;
  staffCount: number;
};

export type CompanyCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  parcels: number;
  spend: number;
  since: string;
  isGuest: boolean;
};

export type CompanyStaffMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  branch: string;
  status: "Active" | "Inactive";
};

export type CompanyPayment = {
  id: string;
  ref: string;
  customer: string;
  method: string;
  amount: number;
  currency: string;
  time: string;
  status: string;
  tracking: string | null;
};

export type DashboardStats = {
  todayParcels: number;
  waitingDropOff: number;
  inStock: number;
  inTransit: number;
  readyCollection: number;
  deliveredToday: number;
  revenueToday: string;
  statusBreakdown: Array<{ label: string; count: number; color: string }>;
  recentParcels: Parcel[];
};

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function requireSession() {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  return supabase;
}

export async function fetchCompanyBranchesDetailed(): Promise<CompanyBranch[]> {
  const supabase = await requireSession();
  if (!supabase) return [];

  const today = startOfTodayIso();

  const { data: branches, error } = await supabase
    .from("branches")
    .select("id, name, code, city, phone, is_head_office, is_active")
    .eq("soft_delete", false)
    .order("is_head_office", { ascending: false })
    .order("name");

  if (error || !branches?.length) {
    if (error) console.warn("[fetchCompanyBranchesDetailed]", error.message);
    return [];
  }

  const ids = branches.map((b) => b.id as string);

  const [{ data: parcelRows }, { data: payRows }, { data: staffRows }] = await Promise.all([
    supabase
      .from("parcels")
      .select("origin_branch_id")
      .eq("soft_delete", false)
      .gte("created_at", today)
      .in("origin_branch_id", ids),
    supabase
      .from("payments")
      .select("amount_cents, parcels!inner(origin_branch_id)")
      .eq("soft_delete", false)
      .eq("status", "completed")
      .gte("paid_at", today),
    supabase
      .from("staff_branch_assignments")
      .select("branch_id")
      .eq("soft_delete", false)
      .in("branch_id", ids),
  ]);

  const parcelsToday = new Map<string, number>();
  for (const row of parcelRows ?? []) {
    const id = row.origin_branch_id as string;
    parcelsToday.set(id, (parcelsToday.get(id) ?? 0) + 1);
  }

  const revenueToday = new Map<string, number>();
  for (const row of payRows ?? []) {
    const parcel = row.parcels as { origin_branch_id: string } | null;
    const id = parcel?.origin_branch_id;
    if (!id) continue;
    revenueToday.set(id, (revenueToday.get(id) ?? 0) + Math.round(Number(row.amount_cents) / 100));
  }

  const staffCount = new Map<string, number>();
  for (const row of staffRows ?? []) {
    const id = row.branch_id as string;
    staffCount.set(id, (staffCount.get(id) ?? 0) + 1);
  }

  return branches.map((b) => ({
    id: b.id as string,
    name: b.name as string,
    code: b.code as string,
    city: (b.city as string | null) ?? null,
    phone: (b.phone as string | null) ?? null,
    isHeadOffice: Boolean(b.is_head_office),
    isActive: b.is_active !== false,
    parcelsToday: parcelsToday.get(b.id as string) ?? 0,
    revenueToday: revenueToday.get(b.id as string) ?? 0,
    staffCount: staffCount.get(b.id as string) ?? 0,
  }));
}

export async function fetchCompanyCustomers(search = ""): Promise<CompanyCustomer[]> {
  const supabase = await requireSession();
  if (!supabase) return [];

  let q = supabase
    .from("customers")
    .select("id, full_name, phone, email, is_guest, created_at")
    .eq("soft_delete", false)
    .order("created_at", { ascending: false })
    .limit(200);

  const s = search.trim();
  if (s) {
    q = q.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const { data: customers, error } = await q;
  if (error) {
    console.warn("[fetchCompanyCustomers]", error.message);
    return [];
  }

  if (!customers?.length) {
    // Derive walk-in senders from parcels until dedicated customer rows exist
    const { data: parcels } = await supabase
      .from("parcels")
      .select("sender_name, sender_phone, shipping_amount_cents, created_at")
      .eq("soft_delete", false)
      .order("created_at", { ascending: false })
      .limit(300);

    const map = new Map<string, CompanyCustomer>();
    for (const p of parcels ?? []) {
      const phone = String(p.sender_phone ?? "").trim();
      if (!phone) continue;
      if (s && ![p.sender_name, phone].join(" ").toLowerCase().includes(s.toLowerCase())) continue;
      const existing = map.get(phone);
      if (existing) {
        existing.parcels += 1;
        existing.spend += Math.round(Number(p.shipping_amount_cents) / 100);
      } else {
        map.set(phone, {
          id: phone,
          name: String(p.sender_name ?? "Customer"),
          phone,
          email: null,
          parcels: 1,
          spend: Math.round(Number(p.shipping_amount_cents) / 100),
          since: new Date(String(p.created_at)).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          isGuest: true,
        });
      }
    }
    return Array.from(map.values()).slice(0, 100);
  }

  const phones = customers.map((c) => c.phone as string);
  const { data: parcels } = await supabase
    .from("parcels")
    .select("sender_phone, shipping_amount_cents")
    .eq("soft_delete", false)
    .in("sender_phone", phones);

  const counts = new Map<string, { n: number; spend: number }>();
  for (const p of parcels ?? []) {
    const phone = p.sender_phone as string;
    const cur = counts.get(phone) ?? { n: 0, spend: 0 };
    cur.n += 1;
    cur.spend += Math.round(Number(p.shipping_amount_cents) / 100);
    counts.set(phone, cur);
  }

  return customers.map((c) => {
    const stats = counts.get(c.phone as string) ?? { n: 0, spend: 0 };
    return {
      id: c.id as string,
      name: c.full_name as string,
      phone: c.phone as string,
      email: (c.email as string | null) ?? null,
      parcels: stats.n,
      spend: stats.spend,
      since: new Date(String(c.created_at)).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      isGuest: Boolean(c.is_guest),
    };
  });
}

export async function fetchCompanyStaff(): Promise<CompanyStaffMember[]> {
  const supabase = await requireSession();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("staff")
    .select(
      `
      id,
      user_id,
      is_active,
      phone,
      roles(name, code),
      users(full_name, email, phone),
      staff_branch_assignments(
        is_primary,
        soft_delete,
        branches(name)
      )
    `,
    )
    .eq("soft_delete", false)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    if (error) console.warn("[fetchCompanyStaff]", error.message);
    return [];
  }

  return data.map((row) => {
    const user = row.users as { full_name: string | null; email: string; phone: string | null } | null;
    const role = row.roles as { name: string; code: string } | null;
    const assignments = (row.staff_branch_assignments as Array<{
      is_primary: boolean;
      soft_delete: boolean;
      branches: { name: string } | null;
    }> | null)?.filter((a) => !a.soft_delete);
    const branch =
      assignments?.find((a) => a.is_primary)?.branches?.name ??
      assignments?.[0]?.branches?.name ??
      (role?.code === "company_admin" ? "All Branches" : "—");

    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: user?.full_name ?? user?.email ?? "Staff",
      email: user?.email ?? "—",
      phone: (row.phone as string | null) ?? user?.phone ?? null,
      role: role?.name ?? role?.code ?? "Staff",
      branch,
      status: row.is_active ? ("Active" as const) : ("Inactive" as const),
    };
  });
}

export async function fetchCompanyPayments(): Promise<{
  rows: CompanyPayment[];
  todayTotal: number;
  mobileMoney: number;
  card: number;
  cash: number;
}> {
  const supabase = await requireSession();
  if (!supabase) {
    return { rows: [], todayTotal: 0, mobileMoney: 0, card: 0, cash: 0 };
  }

  const today = startOfTodayIso();

  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      id,
      reference,
      amount_cents,
      currency_code,
      method_type,
      status,
      paid_at,
      parcels(tracking_number, sender_name)
    `,
    )
    .eq("soft_delete", false)
    .order("paid_at", { ascending: false })
    .limit(100);

  if (error || !data) {
    if (error) console.warn("[fetchCompanyPayments]", error.message);
    return { rows: [], todayTotal: 0, mobileMoney: 0, card: 0, cash: 0 };
  }

  let todayTotal = 0;
  let mobileMoney = 0;
  let card = 0;
  let cash = 0;

  const rows: CompanyPayment[] = data.map((row) => {
    const parcel = row.parcels as { tracking_number: string; sender_name: string } | null;
    const amount = Math.round(Number(row.amount_cents) / 100);
    const method = String(row.method_type);
    const paidAt = String(row.paid_at ?? "");
    const completed = String(row.status) === "completed";

    if (completed && paidAt >= today) {
      todayTotal += amount;
      if (method === "mobile_money") mobileMoney += amount;
      else if (method === "card") card += amount;
      else if (method === "cash") cash += amount;
    }

    return {
      id: row.id as string,
      ref: (row.reference as string) || `PAY-${String(row.id).slice(0, 8)}`,
      customer: parcel?.sender_name ?? "—",
      method: method.replace(/_/g, " "),
      amount,
      currency: String(row.currency_code || "ZMW"),
      time: paidAt
        ? new Date(paidAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      status: String(row.status),
      tracking: parcel?.tracking_number ?? null,
    };
  });

  return { rows, todayTotal, mobileMoney, card, cash };
}

export async function fetchCompanyDashboard(): Promise<DashboardStats> {
  const empty: DashboardStats = {
    todayParcels: 0,
    waitingDropOff: 0,
    inStock: 0,
    inTransit: 0,
    readyCollection: 0,
    deliveredToday: 0,
    revenueToday: money(0),
    statusBreakdown: [],
    recentParcels: [],
  };

  const supabase = await requireSession();
  if (!supabase) return empty;

  const today = startOfTodayIso();
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

  const [
    { count: todayParcels },
    { count: waitingDropOff },
    { count: inStock },
    { count: inTransit },
    { count: readyCollection },
    { count: deliveredToday },
    { data: paymentsToday },
    { data: recent },
    { data: statusRows },
  ] = await Promise.all([
    supabase
      .from("parcels")
      .select("id", { count: "exact", head: true })
      .eq("soft_delete", false)
      .gte("created_at", today),
    supabase
      .from("parcels")
      .select("id", { count: "exact", head: true })
      .eq("soft_delete", false)
      .eq("status", "waiting_for_dropoff"),
    supabase
      .from("parcels")
      .select("id", { count: "exact", head: true })
      .eq("soft_delete", false)
      .in("status", ["received", "reception_verification", "label_printed", "awaiting_payment"]),
    supabase
      .from("parcels")
      .select("id", { count: "exact", head: true })
      .eq("soft_delete", false)
      .in("status", ["dispatched", "in_transit"]),
    supabase
      .from("parcels")
      .select("id", { count: "exact", head: true })
      .eq("soft_delete", false)
      .eq("status", "ready_for_collection"),
    supabase
      .from("parcels")
      .select("id", { count: "exact", head: true })
      .eq("soft_delete", false)
      .eq("status", "collected")
      .gte("updated_at", today),
    supabase
      .from("payments")
      .select("amount_cents")
      .eq("soft_delete", false)
      .eq("status", "completed")
      .gte("paid_at", today),
    supabase
      .from("parcels")
      .select(PARCEL_SELECT)
      .eq("soft_delete", false)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("parcels").select("status").eq("soft_delete", false).limit(2000),
  ]);

  const revenueCents = (paymentsToday ?? []).reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0);

  const counts: Record<string, number> = {};
  for (const row of statusRows ?? []) {
    const st = String(row.status);
    counts[st] = (counts[st] ?? 0) + 1;
  }

  const palette: Array<{ key: string; label: string; color: string }> = [
    { key: "waiting_for_dropoff", label: "Waiting", color: "#3B82F6" },
    { key: "received", label: "Received", color: "#F59E0B" },
    { key: "dispatched", label: "Dispatched", color: "#8B5CF6" },
    { key: "in_transit", label: "In transit", color: "#6366F1" },
    { key: "ready_for_collection", label: "Ready", color: "#10B981" },
    { key: "collected", label: "Collected", color: "#059669" },
  ];

  return {
    todayParcels: todayParcels ?? 0,
    waitingDropOff: waitingDropOff ?? 0,
    inStock: inStock ?? 0,
    inTransit: inTransit ?? 0,
    readyCollection: readyCollection ?? 0,
    deliveredToday: deliveredToday ?? 0,
    revenueToday: money(Math.round(revenueCents / 100)),
    statusBreakdown: palette.map((p) => ({
      label: p.label,
      count: counts[p.key] ?? 0,
      color: p.color,
    })),
    recentParcels: ((recent as unknown as DbParcelRow[]) ?? []).map(mapDbParcelToUi),
  };
}

export async function fetchCompanyVehicles() {
  const supabase = await requireSession();
  if (!supabase) return { vehicles: [], pendingDispatch: 0, dispatchedToday: 0, driversReady: 0 };

  const today = startOfTodayIso();

  const [{ data: vehicles }, { count: pendingDispatch }, { count: dispatchedToday }, { count: driversReady }] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select("id, registration_no, make, model, capacity_kg, is_active")
        .eq("soft_delete", false)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("parcels")
        .select("id", { count: "exact", head: true })
        .eq("soft_delete", false)
        .eq("status", "received"),
      supabase
        .from("parcels")
        .select("id", { count: "exact", head: true })
        .eq("soft_delete", false)
        .eq("status", "dispatched")
        .gte("updated_at", today),
      supabase
        .from("drivers")
        .select("id", { count: "exact", head: true })
        .eq("soft_delete", false)
        .eq("is_available", true),
    ]);

  return {
    vehicles: (vehicles ?? []).map((v) => ({
      id: v.id as string,
      label: [v.make, v.model].filter(Boolean).join(" ") || "Vehicle",
      registration: v.registration_no as string,
      driver: "Assign at dispatch",
      capacity: Number(v.capacity_kg ?? 0) || 50,
      active: v.is_active !== false,
    })),
    pendingDispatch: pendingDispatch ?? 0,
    dispatchedToday: dispatchedToday ?? 0,
    driversReady: driversReady ?? 0,
  };
}

export async function fetchCustomerParcels(phone: string): Promise<Parcel[]> {
  const supabase = await requireSession();
  if (!supabase || !phone.trim()) return [];

  const { data } = await supabase
    .from("parcels")
    .select(
      `
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
    `,
    )
    .eq("soft_delete", false)
    .eq("sender_phone", phone)
    .order("created_at", { ascending: false })
    .limit(20);

  return ((data as unknown as DbParcelRow[]) ?? []).map(mapDbParcelToUi);
}
