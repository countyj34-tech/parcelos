import type { Parcel, ParcelStatus } from "@/lib/mock-data";
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
  category?: { name: string } | null;
};

export function mapDbParcelToUi(row: DbParcelRow): Parcel {
  return {
    tracking: row.tracking_number,
    sender: row.sender_name,
    senderPhone: row.sender_phone,
    receiver: row.receiver_name,
    receiverPhone: row.receiver_phone,
    origin: row.origin?.name ?? "—",
    destination: row.destination?.name ?? "—",
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
  subscriptions?: Array<{
    status: string;
    subscription_plans: { name: string } | null;
  }> | null;
};

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
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    slug: row.slug,
    country: row.country_code,
    status: statusMap[row.status] ?? row.status,
    plan: planName,
    trial: sub?.status === "trialing",
    subdomain: row.subdomain,
    logoInitials: row.name.split(" ").map((w) => w[0]).join("").slice(0, 2),
    createdDate: new Date(row.created_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    expiryDate: row.trial_ends_at
      ? new Date(row.trial_ends_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—",
    branches: 0,
    users: 0,
    parcelsToday: 0,
    storage: "—",
    mrr: 0,
    autoRenewal: true,
    outstanding: 0,
    startDate: new Date(row.created_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    smsUsed: 0,
  };
}
