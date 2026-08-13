/**
 * RLS policy documentation and role-permission matrix.
 * Policies are enforced in PostgreSQL — this file is reference only.
 *
 * @see supabase/migrations/20260312000008_rls_policies.sql
 */

export const ROLE_PERMISSIONS = {
  platform_owner: ["*"],
  company_admin: ["parcels.*", "staff.*", "branches.*", "settings.*", "reports.*"],
  branch_manager: ["parcels.read", "parcels.update", "staff.read"],
  receptionist: ["parcels.create", "parcels.read", "payments.collect"],
  dispatcher: ["parcels.read", "parcels.dispatch", "drivers.read"],
  finance: ["payments.*", "reports.view"],
  customer_support: ["parcels.read", "customers.read", "support.*"],
  driver: ["parcels.read.assigned", "driver_assignments.update"],
  customer: ["parcels.read.own", "receivers.*"],
  guest: ["parcels.create.guest"],
  auditor: ["*.read", "audit.view"],
} as const;

export type RoleCode = keyof typeof ROLE_PERMISSIONS;

/** Branch-scoped roles — filtered by staff_branch_assignments. */
export const BRANCH_SCOPED_ROLES: RoleCode[] = ["branch_manager", "receptionist", "driver"];

/** Company-wide roles — access all branches within tenant. */
export const COMPANY_WIDE_ROLES: RoleCode[] = [
  "company_admin",
  "dispatcher",
  "finance",
  "customer_support",
  "auditor",
];
