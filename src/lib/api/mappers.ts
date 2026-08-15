import type { Parcel, ParcelStatus } from "@/lib/types/parcel";
import type { ParcelPaymentStatus, ParcelStatusCode } from "@/backend/database/types";

export const STATUS_TO_UI: Record<ParcelStatusCode, ParcelStatus> = {
  waiting_for_dropoff: "Waiting for Drop-off",
  reception_verification: "Received",
  awaiting_payment: "Waiting for Drop-off",
  label_printed: "Received",
  received: "Received",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  at_destination_branch: "Arrived",
  ready_for_collection: "Ready for Collection",
  collected: "Collected",
  cancelled: "Waiting for Drop-off",
  returned: "Arrived",
};

export function formatParcelStatus(status: string): ParcelStatus | string {
  return STATUS_TO_UI[status as ParcelStatusCode] ?? status.replace(/_/g, " ");
}

const PAYMENT_TO_UI: Record<ParcelPaymentStatus, Parcel["payment"]> = {
  unpaid: "Unpaid",
  paid: "Paid",
  cash_on_collection: "Cash on Collection",
  refunded: "Paid",
  partial: "Unpaid",
};

export type DbParcelRow = {
  id: string;
  tracking_number: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  status: ParcelStatusCode;
  payment_status: ParcelPaymentStatus;
  shipping_amount_cents: number;
  weight_kg: number | null;
  declared_value_cents: number | null;
  created_at: string;
  origin?: { name: string } | null;
  destination?: { name: string } | null;
  origin_branch_id?: string;
  destination_branch_id?: string;
  collected_at?: string | null;
  category?: { name: string } | null;
};

export function mapDbParcelToUi(row: DbParcelRow): Parcel {
  return {
    id: row.id,
    tracking: row.tracking_number,
    sender: row.sender_name,
    senderPhone: row.sender_phone,
    receiver: row.receiver_name,
    receiverPhone: row.receiver_phone,
    origin: row.origin?.name ?? "—",
    destination: row.destination?.name ?? "—",
    originBranchId: row.origin_branch_id,
    destBranchId: row.destination_branch_id,
    collectedAt: row.collected_at ?? null,
    status: STATUS_TO_UI[row.status] ?? "Received",
    payment: PAYMENT_TO_UI[row.payment_status] ?? "Unpaid",
    amount: Math.round(row.shipping_amount_cents / 100),
    branch: row.origin?.name ?? "—",
    weight: row.weight_kg != null ? `${row.weight_kg} kg` : "—",
    category: row.category?.name ?? "General",
    declaredValue: row.declared_value_cents != null ? Math.round(row.declared_value_cents / 100) : 0,
    created: new Date(row.created_at).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export type DbCompanyRow = {
  id: string;
  name: string;
  code: string;
  slug: string;
  country_code: string;
  status: string;
  subdomain: string;
  trial_ends_at: string | null;
  created_at: string;
  currency_code?: string | null;
  email?: string | null;
  phone?: string | null;
  branches?: number;
  users?: number;
  parcels_today?: number;
  sms_used?: number;
  storage_bytes?: number;
  mrr_cents?: number;
  auto_renew?: boolean;
  outstanding_cents?: number;
  subscriptions?: Array<{
    status: string;
    subscription_plans: { name: string } | null;
  }> | null;
};

function formatBytes(bytes: number | undefined | null): string {
  const n = Number(bytes ?? 0);
  if (!n) return "0 GB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} GB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} TB`;
}

export function mapDbCompanyToPlatform(row: DbCompanyRow) {
  const sub = row.subscriptions?.[0];
  const planName = sub?.subscription_plans?.name ?? "Starter";
  const statusMap: Record<string, string> = {
    active: "Active",
    trial: "Trial",
    expired: "Expired",
    suspended: "Suspended",
    paused: "Paused",
    disconnected: "Disconnected",
    past_due: "Past due",
  };
  const name = row.name?.trim() || row.slug?.trim() || "Company";
  const plan = (["Starter", "Professional", "Enterprise", "Custom"].includes(planName)
    ? planName
    : "Starter") as "Starter" | "Professional" | "Enterprise" | "Custom";
  return {
    id: row.id,
    name,
    code: row.code ?? "—",
    slug: row.slug ?? row.id,
    country: row.country_code ?? "—",
    status: (statusMap[String(row.status).toLowerCase()] ?? row.status ?? "Trial") as
      | "Active"
      | "Trial"
      | "Expired"
      | "Suspended"
      | "Past due"
      | "Paused"
      | "Disconnected",
    plan,
    trial: sub?.status === "trialing",
    subdomain: row.subdomain ?? "—",
    logoInitials: name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "CO",
    createdDate: row.created_at
      ? new Date(row.created_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—",
    expiryDate: row.trial_ends_at
      ? new Date(row.trial_ends_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—",
    branches: Number(row.branches ?? 0),
    users: Number(row.users ?? 0),
    parcelsToday: Number(row.parcels_today ?? 0),
    storage: formatBytes(row.storage_bytes),
    mrr: Math.round(Number(row.mrr_cents ?? 0) / 100),
    autoRenewal: row.auto_renew !== false,
    outstanding: Math.round(Number(row.outstanding_cents ?? 0) / 100),
    startDate: row.created_at
      ? new Date(row.created_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—",
    smsUsed: Number(row.sms_used ?? 0),
    currency: row.currency_code ?? "ZMW",
    email: row.email ?? "",
    phone: row.phone ?? "",
    revenue: Math.round(Number(row.mrr_cents ?? 0) / 100),
  };
}
