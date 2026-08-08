-- =============================================================================
-- ParcelOS — Row Level Security Policies
-- Every tenant table is isolated by company_id. Platform owner bypasses RLS.
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_branch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Macro: tenant table policies (SELECT/INSERT/UPDATE for company isolation)
-- Platform owner gets full access via is_platform_owner()
-- ---------------------------------------------------------------------------

-- Companies
CREATE POLICY companies_platform_all ON public.companies
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY companies_staff_select ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

-- Users
CREATE POLICY users_self ON public.users
  FOR SELECT USING (id = auth.uid() OR public.is_platform_owner());

CREATE POLICY users_company_admin ON public.users
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() = 'company_admin'
  );

CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY users_platform_all ON public.users
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Platform users — platform only
CREATE POLICY platform_users_all ON public.platform_users
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Reference data readable by authenticated users
CREATE POLICY roles_read ON public.roles FOR SELECT TO authenticated USING (soft_delete = FALSE);
CREATE POLICY permissions_read ON public.permissions FOR SELECT TO authenticated USING (soft_delete = FALSE);
CREATE POLICY role_permissions_read ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY subscription_plans_read ON public.subscription_plans FOR SELECT TO authenticated USING (is_active = TRUE AND soft_delete = FALSE);
CREATE POLICY feature_flags_read ON public.feature_flags FOR SELECT TO authenticated USING (soft_delete = FALSE);

CREATE POLICY subscription_plans_platform ON public.subscription_plans
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY feature_flags_platform ON public.feature_flags
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- Helper to apply standard tenant policies
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'company_settings', 'subscriptions', 'company_feature_flags', 'domains',
    'branches', 'staff', 'staff_branch_assignments', 'customers', 'receivers',
    'vehicles', 'drivers', 'shipping_rates', 'payment_methods',
    'parcel_categories', 'parcel_status',
    'parcel_tracking', 'parcel_history', 'parcel_notes',
    'payments', 'sms_logs', 'support_tickets', 'storage_usage', 'api_keys'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I_platform_all ON public.%I FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY %I_tenant_select ON public.%I FOR SELECT USING (company_id = public.get_user_company_id() AND soft_delete = FALSE)',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY %I_tenant_insert ON public.%I FOR INSERT WITH CHECK (company_id = public.get_user_company_id())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY %I_tenant_update ON public.%I FOR UPDATE USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id())',
      t, t
    );
  END LOOP;
END $$;

-- Parcels & driver assignments — role-scoped (excluded from generic tenant loop)
CREATE POLICY parcels_platform_all ON public.parcels
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY parcels_tenant_insert ON public.parcels
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY parcels_tenant_update ON public.parcels
  FOR UPDATE USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY driver_assignments_platform_all ON public.driver_assignments
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY driver_assignments_tenant ON public.driver_assignments
  FOR ALL USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Subscriptions: company admin read
CREATE POLICY subscriptions_company_admin ON public.subscriptions
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() IN ('company_admin', 'finance')
  );

-- Parcels: branch-scoped read for receptionist / branch manager
CREATE POLICY parcels_branch_scope ON public.parcels
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() IN ('company_admin', 'finance', 'dispatcher', 'customer_support', 'auditor')
  );

CREATE POLICY parcels_branch_limited ON public.parcels
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() IN ('branch_manager', 'receptionist')
    AND (
      origin_branch_id IN (SELECT public.get_user_branch_ids())
      OR destination_branch_id IN (SELECT public.get_user_branch_ids())
      OR current_branch_id IN (SELECT public.get_user_branch_ids())
    )
  );

-- Drivers: only assigned parcels
CREATE POLICY parcels_driver ON public.parcels
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role_code() = 'driver'
    AND EXISTS (
      SELECT 1 FROM public.driver_assignments da
      WHERE da.parcel_id = parcels.id
        AND da.driver_id = public.get_driver_id()
        AND da.soft_delete = FALSE
    )
  );

-- Customers: own parcels only (customer portal)
CREATE POLICY parcels_customer ON public.parcels
  FOR SELECT USING (
    sender_customer_id = public.get_customer_id()
    OR receiver_phone IN (
      SELECT phone FROM public.customers WHERE id = public.get_customer_id()
    )
  );

-- Public tracking by tracking number (anon read via edge function or limited view)
CREATE POLICY parcel_tracking_public ON public.parcel_tracking
  FOR SELECT USING (is_public = TRUE AND soft_delete = FALSE);

CREATE POLICY parcel_tracking_tenant ON public.parcel_tracking
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Notifications
CREATE POLICY notifications_user ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_platform ON public.notifications
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE POLICY notifications_tenant ON public.notifications
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Audit logs
CREATE POLICY audit_logs_platform ON public.audit_logs
  FOR ALL USING (public.is_platform_owner());

CREATE POLICY audit_logs_company ON public.audit_logs
  FOR SELECT USING (company_id = public.get_user_company_id());

-- System logs — platform only
CREATE POLICY system_logs_platform ON public.system_logs
  FOR ALL USING (public.is_platform_owner());

-- Sessions
CREATE POLICY sessions_self ON public.sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY sessions_platform ON public.sessions
  FOR ALL USING (public.is_platform_owner());

-- Email logs
CREATE POLICY email_logs_platform ON public.email_logs
  FOR ALL USING (public.is_platform_owner());

CREATE POLICY email_logs_tenant ON public.email_logs
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Customers self-access
CREATE POLICY customers_self ON public.customers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY receivers_customer ON public.receivers
  FOR SELECT USING (customer_id = public.get_customer_id());

-- Driver assignments
CREATE POLICY driver_assignments_driver ON public.driver_assignments
  FOR SELECT USING (driver_id = public.get_driver_id());

-- Grant usage to authenticated and service_role
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
