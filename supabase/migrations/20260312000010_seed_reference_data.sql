-- =============================================================================
-- ParcelOS — Seed Reference Data (roles, permissions, plans, feature flags)
-- =============================================================================

INSERT INTO public.roles (code, name, description, scope) VALUES
  ('platform_owner', 'Platform Owner', 'MTHUNZI-TECH-LABS super admin', 'platform'),
  ('company_admin', 'Company Admin', 'Full access within courier company', 'company'),
  ('branch_manager', 'Branch Manager', 'Branch-scoped management', 'branch'),
  ('receptionist', 'Receptionist', 'Reception and parcel intake', 'branch'),
  ('dispatcher', 'Dispatcher', 'Dispatch and routing operations', 'company'),
  ('finance', 'Finance', 'Billing and financial reports', 'company'),
  ('customer_support', 'Customer Support', 'Customer and ticket support', 'company'),
  ('driver', 'Driver', 'Assigned delivery operations', 'branch'),
  ('customer', 'Customer', 'Customer portal access', 'customer'),
  ('guest', 'Guest', 'Guest parcel registration', 'guest'),
  ('auditor', 'Auditor', 'Read-only audit access', 'company')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.permissions (code, name, module) VALUES
  ('parcels.create', 'Create parcels', 'parcels'),
  ('parcels.read', 'View parcels', 'parcels'),
  ('parcels.update', 'Update parcels', 'parcels'),
  ('parcels.delete', 'Delete parcels', 'parcels'),
  ('parcels.dispatch', 'Dispatch parcels', 'parcels'),
  ('payments.collect', 'Collect payments', 'payments'),
  ('payments.refund', 'Process refunds', 'payments'),
  ('reports.view', 'View reports', 'reports'),
  ('staff.manage', 'Manage staff', 'staff'),
  ('branches.manage', 'Manage branches', 'branches'),
  ('settings.manage', 'Manage company settings', 'settings'),
  ('companies.manage', 'Manage companies (platform)', 'platform'),
  ('subscriptions.manage', 'Manage subscriptions', 'platform'),
  ('audit.view', 'View audit logs', 'audit')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.subscription_plans (code, name, price_cents, currency_code, max_branches, max_users, max_storage_gb, max_sms_monthly, features, sort_order) VALUES
  ('starter', 'Starter', 99000, 'USD', 1, 8, 10, 1000, '["Parcel ops","SMS","Customer portal"]', 1),
  ('professional', 'Professional', 249000, 'USD', 10, NULL, 50, 5000, '["Dispatch","WhatsApp","Reports","Multi-branch"]', 2),
  ('enterprise', 'Enterprise', 0, 'USD', NULL, NULL, 500, 50000, '["API","SSO","SLA","Dedicated support"]', 3),
  ('custom', 'Custom', 0, 'USD', NULL, NULL, 1000, 100000, '["Bespoke integrations"]', 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('ussd', 'USSD', 'USSD parcel tracking and registration', TRUE),
  ('whatsapp', 'WhatsApp', 'WhatsApp notifications', TRUE),
  ('ai_reports', 'AI Reports', 'AI-powered analytics reports', FALSE),
  ('barcode', 'Barcode', 'Barcode label generation', TRUE),
  ('qr_code', 'QR Code', 'QR code on labels and tracking', TRUE),
  ('driver_app', 'Driver App', 'Mobile driver application', TRUE),
  ('public_api', 'Public API', 'REST API for integrations', TRUE),
  ('customer_portal', 'Customer Portal', 'White-label customer portal', TRUE),
  ('loyalty', 'Loyalty', 'Customer loyalty programme', FALSE),
  ('pwa_install', 'PWA Install Prompt', 'Progressive web app install', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.parcel_status (company_id, code, label, sort_order, is_terminal)
SELECT NULL, v.code, v.label, v.sort_order, v.is_terminal
FROM (VALUES
  ('waiting_for_dropoff'::parcel_status_code, 'Waiting For Drop-off', 1, FALSE),
  ('reception_verification', 'Reception Verification', 2, FALSE),
  ('awaiting_payment', 'Awaiting Payment', 3, FALSE),
  ('label_printed', 'Label Printed', 4, FALSE),
  ('received', 'Received', 5, FALSE),
  ('dispatched', 'Dispatched', 6, FALSE),
  ('in_transit', 'In Transit', 7, FALSE),
  ('at_destination_branch', 'Destination Branch', 8, FALSE),
  ('ready_for_collection', 'Ready For Collection', 9, FALSE),
  ('collected', 'Collected', 10, TRUE),
  ('cancelled', 'Cancelled', 11, TRUE),
  ('returned', 'Returned', 12, TRUE)
) AS v(code, label, sort_order, is_terminal)
WHERE NOT EXISTS (
  SELECT 1 FROM public.parcel_status ps
  WHERE ps.company_id IS NULL AND ps.code = v.code
);
