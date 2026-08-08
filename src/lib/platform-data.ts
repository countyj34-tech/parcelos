import { COMPANIES, type CompanyRecord } from "@/lib/mock-data";
import { applyLifecycleOverrides } from "@/lib/company-lifecycle";

export type PlatformCompany = CompanyRecord & {
  id: string;
  code: string;
  slug: string;
  logoInitials: string;
  createdDate: string;
  subdomain: string;
  currency: string;
  email: string;
  phone: string;
  smsUsed: number;
};

const BASE_PLATFORM_COMPANIES: PlatformCompany[] = COMPANIES.map((c, i) => ({
  ...c,
  id: `co_${i + 1}`,
  code: ["SWL", "MRC", "PLC", "ZMF", "KLP", "ACR"][i]!,
  slug: c.name.toLowerCase().replace(/\s+/g, "-"),
  logoInitials: c.name.split(" ").map((w) => w[0]).join("").slice(0, 2),
  createdDate: c.startDate,
  subdomain: `${c.name.split(" ")[0]!.toLowerCase()}.parcelos.africa`,
  currency: c.country === "Kenya" ? "KES" : c.country === "Uganda" ? "UGX" : "ZMW",
  email: `hello@${c.name.split(" ")[0]!.toLowerCase()}.com`,
  phone: "+260 211 234 500",
  smsUsed: Math.round(c.parcelsToday * 2.4),
}));

/** Live list with pause/suspend overrides applied. */
export function getPlatformCompanies(): PlatformCompany[] {
  return applyLifecycleOverrides(BASE_PLATFORM_COMPANIES);
}

/** @deprecated Prefer getPlatformCompanies() so kill-switch status is included. */
export const PLATFORM_COMPANIES = BASE_PLATFORM_COMPANIES;

export const PLATFORM_OVERVIEW = {
  activeCompanies: 42,
  trialCompanies: 4,
  expiredCompanies: 1,
  suspendedCompanies: 1,
  monthlyRevenue: 186400,
  todayParcels: 18420,
  platformUsers: 3914,
  branches: 380,
  storageUsed: "1.2 TB",
  storageLimit: "2 TB",
  smsRemaining: 842000,
  apiRequests: "2.4M",
  expiredCount: 1,
};

export const PLATFORM_CHARTS = {
  revenue: [
    { month: "Oct", value: 142000 },
    { month: "Nov", value: 158000 },
    { month: "Dec", value: 172000 },
    { month: "Jan", value: 164000 },
    { month: "Feb", value: 178000 },
    { month: "Mar", value: 186400 },
  ],
  companyGrowth: [
    { month: "Oct", value: 32 },
    { month: "Nov", value: 35 },
    { month: "Dec", value: 38 },
    { month: "Jan", value: 40 },
    { month: "Feb", value: 44 },
    { month: "Mar", value: 48 },
  ],
  parcels: [
    { month: "Oct", value: 892000 },
    { month: "Nov", value: 945000 },
    { month: "Dec", value: 1020000 },
    { month: "Jan", value: 980000 },
    { month: "Feb", value: 1080000 },
    { month: "Mar", value: 1140000 },
  ],
  subscriptions: [
    { month: "Oct", value: 28 },
    { month: "Nov", value: 31 },
    { month: "Dec", value: 34 },
    { month: "Jan", value: 36 },
    { month: "Feb", value: 40 },
    { month: "Mar", value: 44 },
  ],
};

export const SUBSCRIPTION_PLANS = [
  {
    name: "Starter",
    price: "K990/mo",
    branches: 1,
    users: 8,
    storage: "10 GB",
    sms: "1,000/mo",
    features: ["Parcel ops", "SMS", "Customer portal"],
    companies: 14,
    revenue: 13860,
  },
  {
    name: "Professional",
    price: "K2,490/mo",
    branches: 10,
    users: "Unlimited",
    storage: "50 GB",
    sms: "5,000/mo",
    features: ["Dispatch", "WhatsApp", "Reports", "Multi-branch"],
    companies: 22,
    revenue: 54780,
  },
  {
    name: "Enterprise",
    price: "Custom",
    branches: "Unlimited",
    users: "Unlimited",
    storage: "500 GB",
    sms: "Custom",
    features: ["API", "SSO", "SLA", "Dedicated support"],
    companies: 8,
    revenue: 96000,
  },
  {
    name: "Custom",
    price: "Negotiated",
    branches: "Custom",
    users: "Custom",
    storage: "Custom",
    sms: "Custom",
    features: ["Bespoke integrations"],
    companies: 4,
    revenue: 21760,
  },
];

export const FEATURE_FLAGS = [
  { key: "ussd", label: "USSD", enabled: true },
  { key: "whatsapp", label: "WhatsApp", enabled: true },
  { key: "ai_reports", label: "AI Reports", enabled: false },
  { key: "barcode", label: "Barcode", enabled: true },
  { key: "qr_code", label: "QR Code", enabled: true },
  { key: "driver_app", label: "Driver App", enabled: true },
  { key: "public_api", label: "Public API", enabled: true },
  { key: "customer_portal", label: "Customer Portal", enabled: true },
  { key: "loyalty", label: "Loyalty", enabled: false },
  { key: "pwa_install", label: "PWA Install Prompt", enabled: true },
];

export const PLATFORM_DOMAINS = BASE_PLATFORM_COMPANIES.map((c) => ({
  company: c.name,
  subdomain: c.subdomain,
  custom: c.slug === "swift-logistics" ? "track.swiftlogistics.zm" : null,
  ssl: "Active",
  verified: true,
}));

export const AUDIT_LOGS = [
  { id: 1, action: "Company Created", target: "Platinum Courier", actor: "Admin User", when: "2 hrs ago" },
  { id: 2, action: "Login As Company", target: "Swift Logistics", actor: "Admin User", when: "4 hrs ago" },
  { id: 3, action: "Subscription Upgraded", target: "Mercury Express", actor: "Admin User", when: "1 d ago" },
  { id: 4, action: "Company Suspended", target: "Accra Runners", actor: "Admin User", when: "2 d ago" },
  { id: 5, action: "Password Reset", target: "Kilimanjaro Post admin", actor: "Admin User", when: "3 d ago" },
  { id: 6, action: "Feature Flag Updated", target: "AI Reports enabled", actor: "Admin User", when: "5 d ago" },
  { id: 7, action: "Company Deleted", target: "Legacy Couriers Ltd", actor: "Admin User", when: "1 w ago" },
];

export const PLATFORM_USERS_LIST = [
  { name: "Admin User", email: "admin@mthunzi.tech", role: "Super Admin", lastActive: "Just now" },
  { name: "Sarah Mwanza", email: "sarah@mthunzi.tech", role: "Support Agent", lastActive: "12 min ago" },
  { name: "James Banda", email: "james@mthunzi.tech", role: "Billing Admin", lastActive: "1 hr ago" },
];

export const RECENT_PAYMENTS = [
  { company: "Swift Logistics", amount: "K 34,500", status: "Paid", date: "12 Mar 2026" },
  { company: "Mercury Express", amount: "K 24,000", status: "Paid", date: "12 Mar 2026" },
  { company: "Kilimanjaro Post", amount: "K 48,000", status: "Failed", date: "11 Mar 2026" },
];

export const PLATFORM_ACTIVITIES = [
  { text: "Platinum Courier started 14-day trial", when: "2 hrs ago" },
  { text: "Swift Logistics processed 468 parcels today", when: "3 hrs ago" },
  { text: "New support ticket from Kilimanjaro Post", when: "5 hrs ago" },
  { text: "Mercury Express renewed Professional plan", when: "Yesterday" },
];

export const INTEGRATIONS = [
  { name: "Africa's Talking SMS", status: "Connected", type: "SMS" },
  { name: "Twilio WhatsApp", status: "Connected", type: "WhatsApp" },
  { name: "SendGrid Email", status: "Connected", type: "Email" },
  { name: "Flutterwave", status: "Connected", type: "Payments" },
  { name: "Google Maps", status: "Connected", type: "Maps" },
  { name: "Supabase Storage", status: "Connected", type: "Storage" },
];

export function getCompanyBySlug(slug: string) {
  return getPlatformCompanies().find((c) => c.slug === slug);
}
