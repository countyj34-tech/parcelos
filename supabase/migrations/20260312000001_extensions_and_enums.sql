-- =============================================================================
-- ParcelOS — Extensions & Enumerated Types
-- MTHUNZI-TECH-LABS · Multi-tenant courier SaaS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------------------------
-- Company lifecycle
-- ---------------------------------------------------------------------------
CREATE TYPE company_status AS ENUM (
  'active',
  'trial',
  'expired',
  'suspended',
  'paused',
  'disconnected',
  'past_due'
);

-- ---------------------------------------------------------------------------
-- Subscription billing
-- ---------------------------------------------------------------------------
CREATE TYPE subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired',
  'paused'
);

CREATE TYPE billing_interval AS ENUM ('monthly', 'quarterly', 'yearly', 'custom');

-- ---------------------------------------------------------------------------
-- Parcel workflow (canonical status progression)
-- ---------------------------------------------------------------------------
CREATE TYPE parcel_status_code AS ENUM (
  'waiting_for_dropoff',
  'reception_verification',
  'awaiting_payment',
  'label_printed',
  'received',
  'dispatched',
  'in_transit',
  'at_destination_branch',
  'ready_for_collection',
  'collected',
  'cancelled',
  'returned'
);

CREATE TYPE parcel_payment_status AS ENUM (
  'unpaid',
  'paid',
  'cash_on_collection',
  'refunded',
  'partial'
);

CREATE TYPE payment_method_type AS ENUM (
  'cash',
  'card',
  'bank_transfer',
  'mobile_money'
);

CREATE TYPE notification_channel AS ENUM ('in_app', 'sms', 'email', 'whatsapp', 'push');

CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'read');

CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');

CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE ticket_type AS ENUM ('support', 'feature_request', 'bug_report', 'live_chat');

CREATE TYPE domain_type AS ENUM ('subdomain', 'custom');

CREATE TYPE ssl_status AS ENUM ('pending', 'active', 'expired', 'failed');

CREATE TYPE driver_assignment_status AS ENUM (
  'assigned',
  'accepted',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE user_type AS ENUM (
  'platform',
  'staff',
  'customer',
  'guest'
);

CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'password_reset',
  'suspend',
  'reactivate',
  'upgrade',
  'downgrade',
  'login_as',
  'payment',
  'broadcast'
);

CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');

-- ---------------------------------------------------------------------------
-- Reusable trigger: maintain updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at IS
  'Automatically sets updated_at to current timestamp on row update.';
