/**
 * ParcelOS database types — mirrors PostgreSQL schema.
 * Regenerate with: npx supabase gen types typescript --local > src/backend/database/schema.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CompanyStatus =
  | "active"
  | "trial"
  | "expired"
  | "suspended"
  | "paused"
  | "disconnected"
  | "past_due";

export type ParcelStatusCode =
  | "waiting_for_dropoff"
  | "reception_verification"
  | "awaiting_payment"
  | "label_printed"
  | "received"
  | "dispatched"
  | "in_transit"
  | "at_destination_branch"
  | "ready_for_collection"
  | "collected"
  | "cancelled"
  | "returned";

export type ParcelPaymentStatus = "unpaid" | "paid" | "cash_on_collection" | "refunded" | "partial";

export type PaymentMethodType = "cash" | "card" | "bank_transfer" | "mobile_money";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired" | "paused";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "password_reset"
  | "suspend"
  | "reactivate"
  | "upgrade"
  | "downgrade"
  | "login_as"
  | "payment"
  | "broadcast";

/** Standard audit columns on every tenant-scoped business table. */
export type AuditColumns = {
  company_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  soft_delete: boolean;
};

export type Company = {
  id: string;
  name: string;
  code: string;
  slug: string;
  registration_number: string | null;
  country_code: string;
  currency_code: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  favicon_url: string | null;
  subdomain: string;
  default_language: string;
  timezone: string;
  status: CompanyStatus;
  trial_ends_at: string | null;
  suspended_at: string | null;
  paused_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  soft_delete: boolean;
};

export type Parcel = AuditColumns & {
  id: string;
  tracking_number: string;
  barcode: string | null;
  qr_code_url: string | null;
  sender_customer_id: string | null;
  sender_name: string;
  sender_phone: string;
  sender_email: string | null;
  receiver_id: string | null;
  receiver_name: string;
  receiver_phone: string;
  receiver_email: string | null;
  origin_branch_id: string;
  destination_branch_id: string;
  current_branch_id: string | null;
  category_id: string | null;
  status: ParcelStatusCode;
  payment_status: ParcelPaymentStatus;
  weight_kg: number | null;
  declared_value_cents: number | null;
  shipping_amount_cents: number;
  currency_code: string;
  description: string | null;
  label_printed_at: string | null;
  received_at: string | null;
  dispatched_at: string | null;
  ready_at: string | null;
  collected_at: string | null;
  proof_of_delivery_url: string | null;
  metadata: Json;
};

export type ParcelTracking = {
  id: string;
  company_id: string;
  parcel_id: string;
  status: ParcelStatusCode;
  title: string;
  description: string | null;
  branch_id: string | null;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  is_public: boolean;
  occurred_at: string;
  created_at: string;
  created_by: string | null;
  soft_delete: boolean;
};

export type Database = {
  public: {
    Tables: {
      companies: { Row: Company; Insert: Partial<Company>; Update: Partial<Company> };
      parcels: { Row: Parcel; Insert: Partial<Parcel>; Update: Partial<Parcel> };
      parcel_tracking: { Row: ParcelTracking; Insert: Partial<ParcelTracking>; Update: Partial<ParcelTracking> };
    };
  };
};
