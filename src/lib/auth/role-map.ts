import type { UserRole } from "@/lib/roles";

/** Maps PostgreSQL role codes to UI role labels. */
export const DB_ROLE_TO_UI: Record<string, UserRole> = {
  platform_owner: "Super Admin",
  company_admin: "Company Admin",
  branch_manager: "Branch Manager",
  receptionist: "Receptionist",
  dispatcher: "Dispatcher",
  finance: "Finance",
  customer_support: "Customer Support",
  driver: "Driver",
  customer: "Customer",
  guest: "Guest",
  auditor: "Auditor",
};

export function toUiRole(dbCode: string | null | undefined): UserRole {
  if (!dbCode) return "Company Admin";
  return DB_ROLE_TO_UI[dbCode] ?? "Company Admin";
}

export function toDbRole(uiRole: UserRole): string {
  const entry = Object.entries(DB_ROLE_TO_UI).find(([, ui]) => ui === uiRole);
  return entry?.[0] ?? "company_admin";
}
