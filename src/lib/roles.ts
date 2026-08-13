export type UserRole =
  | "Super Admin"
  | "Company Admin"
  | "Branch Manager"
  | "Receptionist"
  | "Dispatcher"
  | "Finance"
  | "Customer Support"
  | "Driver"
  | "Auditor"
  | "Customer";

export type NavItem = {
  label: string;
  to: string;
  exact?: boolean;
};

/** Flat sidebar per product spec */
export const WORKSPACE_NAV: NavItem[] = [
  { label: "Dashboard", to: "/app", exact: true },
  { label: "Parcels", to: "/app/parcels" },
  { label: "Customers", to: "/app/customers" },
  { label: "Reception", to: "/app/reception" },
  { label: "Dispatch", to: "/app/dispatch" },
  { label: "Tracking", to: "/app/tracking" },
  { label: "Branches", to: "/app/branches" },
  { label: "Staff", to: "/app/users" },
  { label: "Reports", to: "/app/reports" },
  { label: "Payments", to: "/app/payments" },
  { label: "Settings", to: "/app/settings" },
  { label: "Help", to: "/app/support" },
];

/** Paths every authenticated staff member may open. */
const SHARED_STAFF_PATHS = ["/app/notifications"] as const;

const ALL_WORKSPACE = WORKSPACE_NAV.map((n) => n.to);

/** Allowed /app routes per role (plus SHARED_STAFF_PATHS). */
const ROLE_PATHS: Record<UserRole, readonly string[]> = {
  "Super Admin": ALL_WORKSPACE,
  "Company Admin": [...ALL_WORKSPACE, "/app/subscription", "/app/onboarding"],
  "Branch Manager": [...ALL_WORKSPACE, "/app/onboarding"],
  Receptionist: ["/app/reception"],
  Dispatcher: ["/app/dispatch", "/app/tracking", "/app/parcels", "/app/reception"],
  Finance: ["/app/reports", "/app/payments"],
  "Customer Support": ["/app/customers", "/app/parcels", "/app/support"],
  Driver: ["/app/dispatch", "/app/tracking"],
  Auditor: ["/app/reports", "/app/parcels"],
  Customer: [],
};

/** Where each role lands after sign-in. */
const ROLE_HOME: Record<UserRole, string> = {
  "Super Admin": "/admin",
  "Company Admin": "/app",
  "Branch Manager": "/app",
  Receptionist: "/app/reception",
  Dispatcher: "/app/dispatch",
  Finance: "/app/reports",
  "Customer Support": "/app/customers",
  Driver: "/app/dispatch",
  Auditor: "/app/reports",
  Customer: "/portal/history",
};

export function getHomeRouteForRole(role: UserRole): string {
  return ROLE_HOME[role] ?? "/app";
}

export function getNavForRole(role: UserRole): NavItem[] {
  const allowed = new Set(ROLE_PATHS[role] ?? ROLE_PATHS["Company Admin"]);
  return WORKSPACE_NAV.filter((item) => allowed.has(item.to));
}

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  const pathname = normalizePath(path.split("?")[0] ?? path);

  if (role === "Super Admin") {
    return pathname.startsWith("/admin") || pathname.startsWith("/app");
  }

  if (pathname.startsWith("/admin")) {
    return false;
  }

  if (role === "Customer") {
    return pathname.startsWith("/portal") || pathname.startsWith("/c/");
  }

  if (!pathname.startsWith("/app")) {
    return true;
  }

  if (SHARED_STAFF_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }

  const allowed = ROLE_PATHS[role] ?? ROLE_PATHS["Company Admin"];
  return allowed.some((p) => {
    if (p === "/app") return pathname === "/app";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

export const ROLE_USERS: Record<
  UserRole,
  { name: string; email: string; initials: string; branch: string }
> = {
  "Super Admin": { name: "Admin User", email: "admin@mthunzi.tech", initials: "AU", branch: "Platform" },
  "Company Admin": { name: "Linda Chirwa", email: "linda@swiftlogistics.zm", initials: "LC", branch: "All Branches" },
  "Branch Manager": { name: "Chileshe Mumba", email: "chileshe@swiftlogistics.zm", initials: "CM", branch: "Lusaka — Cairo Road" },
  Receptionist: { name: "Emmanuel Daka", email: "emmanuel@swiftlogistics.zm", initials: "ED", branch: "Lusaka — Cairo Road" },
  Dispatcher: { name: "Patrick Musonda", email: "patrick@swiftlogistics.zm", initials: "PM", branch: "Ndola — Broadway" },
  Finance: { name: "Grace Banda", email: "finance@swiftlogistics.zm", initials: "GB", branch: "Head Office" },
  "Customer Support": { name: "Mercy Lungu", email: "support@swiftlogistics.zm", initials: "ML", branch: "Head Office" },
  Driver: { name: "Joseph Kunda", email: "joseph@swiftlogistics.zm", initials: "JK", branch: "Ndola — Broadway" },
  Auditor: { name: "David Phiri", email: "audit@swiftlogistics.zm", initials: "DP", branch: "Head Office" },
  Customer: { name: "Guest Customer", email: "customer@example.com", initials: "GC", branch: "Customer" },
};

export const DEMO_ROLES: UserRole[] = [
  "Company Admin",
  "Branch Manager",
  "Receptionist",
  "Dispatcher",
  "Finance",
  "Driver",
  "Customer Support",
];
