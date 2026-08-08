export type ParcelStatus =
  | "Waiting for Drop-off"
  | "Received"
  | "Dispatched"
  | "In Transit"
  | "Arrived"
  | "Ready for Collection"
  | "Collected";

export const PARCEL_FLOW: ParcelStatus[] = [
  "Waiting for Drop-off",
  "Received",
  "Dispatched",
  "In Transit",
  "Arrived",
  "Ready for Collection",
  "Collected",
];

export type Parcel = {
  tracking: string;
  sender: string;
  senderPhone: string;
  receiver: string;
  receiverPhone: string;
  origin: string;
  destination: string;
  status: ParcelStatus;
  payment: "Paid" | "Unpaid" | "Cash on Collection";
  amount: number;
  branch: string;
  weight: string;
  category: string;
  declaredValue: number;
  created: string;
};

export const BRANCHES = [
  "Lusaka — Cairo Road",
  "Lusaka — Kabulonga",
  "Ndola — Broadway",
  "Kitwe — Obote Avenue",
  "Livingstone — Mosi-oa-Tunya",
  "Chipata — Umodzi Highway",
  "Nairobi — Westlands",
  "Kampala — Nakasero",
];

export const CATEGORIES = [
  "Documents",
  "Electronics",
  "Clothing & Textiles",
  "Auto Spares",
  "Groceries & Perishables",
  "Medical Supplies",
  "Fragile Goods",
];

export const PARCELS: Parcel[] = [
  {
    tracking: "POS-249071-ZM",
    sender: "Chanda Mulenga",
    senderPhone: "+260 977 214 880",
    receiver: "Bwalya Nsofwa",
    receiverPhone: "+260 966 331 402",
    origin: "Lusaka — Cairo Road",
    destination: "Ndola — Broadway",
    status: "In Transit",
    payment: "Paid",
    amount: 185,
    branch: "Lusaka — Cairo Road",
    weight: "3.2 kg",
    category: "Electronics",
    declaredValue: 4200,
    created: "12 Mar 2026, 08:14",
  },
  {
    tracking: "POS-249072-ZM",
    sender: "Mwansa Kabaso",
    senderPhone: "+260 955 118 273",
    receiver: "Grace Phiri",
    receiverPhone: "+260 977 902 118",
    origin: "Lusaka — Kabulonga",
    destination: "Kitwe — Obote Avenue",
    status: "Ready for Collection",
    payment: "Cash on Collection",
    amount: 240,
    branch: "Lusaka — Kabulonga",
    weight: "8.6 kg",
    category: "Auto Spares",
    declaredValue: 9800,
    created: "12 Mar 2026, 09:02",
  },
  {
    tracking: "POS-249073-ZM",
    sender: "Naledi Banda",
    senderPhone: "+260 967 553 990",
    receiver: "Joseph Tembo",
    receiverPhone: "+260 976 441 006",
    origin: "Ndola — Broadway",
    destination: "Chipata — Umodzi Highway",
    status: "Received",
    payment: "Paid",
    amount: 120,
    branch: "Ndola — Broadway",
    weight: "1.1 kg",
    category: "Documents",
    declaredValue: 500,
    created: "12 Mar 2026, 09:41",
  },
  {
    tracking: "POS-249074-KE",
    sender: "Amina Wanjiru",
    senderPhone: "+254 712 884 021",
    receiver: "Peter Otieno",
    receiverPhone: "+254 733 221 908",
    origin: "Nairobi — Westlands",
    destination: "Kampala — Nakasero",
    status: "Dispatched",
    payment: "Paid",
    amount: 410,
    branch: "Nairobi — Westlands",
    weight: "12.0 kg",
    category: "Clothing & Textiles",
    declaredValue: 15400,
    created: "12 Mar 2026, 10:05",
  },
  {
    tracking: "POS-249075-ZM",
    sender: "Kondwani Zulu",
    senderPhone: "+260 979 660 145",
    receiver: "Mercy Sakala",
    receiverPhone: "+260 968 774 512",
    origin: "Livingstone — Mosi-oa-Tunya",
    destination: "Lusaka — Cairo Road",
    status: "Collected",
    payment: "Paid",
    amount: 95,
    branch: "Livingstone — Mosi-oa-Tunya",
    weight: "0.6 kg",
    category: "Documents",
    declaredValue: 300,
    created: "11 Mar 2026, 16:22",
  },
  {
    tracking: "POS-249076-ZM",
    sender: "Thandiwe Moyo",
    senderPhone: "+260 962 007 331",
    receiver: "Elias Mwape",
    receiverPhone: "+260 975 220 887",
    origin: "Kitwe — Obote Avenue",
    destination: "Lusaka — Kabulonga",
    status: "Arrived",
    payment: "Unpaid",
    amount: 260,
    branch: "Kitwe — Obote Avenue",
    weight: "6.4 kg",
    category: "Medical Supplies",
    declaredValue: 7300,
    created: "11 Mar 2026, 14:47",
  },
  {
    tracking: "POS-249077-UG",
    sender: "Ssemakula Brian",
    senderPhone: "+256 772 445 019",
    receiver: "Aisha Nakato",
    receiverPhone: "+256 701 336 552",
    origin: "Kampala — Nakasero",
    destination: "Nairobi — Westlands",
    status: "Waiting for Drop-off",
    payment: "Unpaid",
    amount: 380,
    branch: "Kampala — Nakasero",
    weight: "4.8 kg",
    category: "Fragile Goods",
    declaredValue: 6100,
    created: "12 Mar 2026, 07:10",
  },
  {
    tracking: "POS-249078-ZM",
    sender: "Lombe Chibuye",
    senderPhone: "+260 971 552 300",
    receiver: "Daniel Mwila",
    receiverPhone: "+260 964 118 774",
    origin: "Chipata — Umodzi Highway",
    destination: "Ndola — Broadway",
    status: "In Transit",
    payment: "Paid",
    amount: 315,
    branch: "Chipata — Umodzi Highway",
    weight: "10.2 kg",
    category: "Groceries & Perishables",
    declaredValue: 2200,
    created: "12 Mar 2026, 06:35",
  },
];

export const REVENUE_SERIES = [
  { month: "Sep", revenue: 184000, parcels: 3120 },
  { month: "Oct", revenue: 212500, parcels: 3480 },
  { month: "Nov", revenue: 241800, parcels: 3925 },
  { month: "Dec", revenue: 309400, parcels: 4810 },
  { month: "Jan", revenue: 268900, parcels: 4210 },
  { month: "Feb", revenue: 294600, parcels: 4560 },
  { month: "Mar", revenue: 331200, parcels: 5040 },
];

export const BRANCH_PERFORMANCE = [
  { branch: "Cairo Road", parcels: 1240, revenue: 96400 },
  { branch: "Kabulonga", parcels: 880, revenue: 71200 },
  { branch: "Broadway", parcels: 760, revenue: 58900 },
  { branch: "Obote Ave", parcels: 640, revenue: 47300 },
  { branch: "Westlands", parcels: 520, revenue: 42800 },
  { branch: "Nakasero", parcels: 410, revenue: 31600 },
];

export const BRANCH_CARDS = [
  {
    name: "Lusaka — Cairo Road",
    code: "LSK-01",
    manager: "Chileshe Mumba",
    staff: 14,
    parcelsToday: 182,
    revenue: 96400,
    capacity: 86,
    phone: "+260 211 234 500",
  },
  {
    name: "Lusaka — Kabulonga",
    code: "LSK-02",
    manager: "Natasha Zimba",
    staff: 9,
    parcelsToday: 121,
    revenue: 71200,
    capacity: 64,
    phone: "+260 211 234 512",
  },
  {
    name: "Ndola — Broadway",
    code: "NDL-01",
    manager: "Fred Chilufya",
    staff: 11,
    parcelsToday: 98,
    revenue: 58900,
    capacity: 72,
    phone: "+260 212 611 800",
  },
  {
    name: "Kitwe — Obote Avenue",
    code: "KIT-01",
    manager: "Beatrice Ngoma",
    staff: 8,
    parcelsToday: 76,
    revenue: 47300,
    capacity: 51,
    phone: "+260 212 220 341",
  },
  {
    name: "Nairobi — Westlands",
    code: "NBO-01",
    manager: "Kevin Njoroge",
    staff: 12,
    parcelsToday: 88,
    revenue: 42800,
    capacity: 68,
    phone: "+254 20 445 1180",
  },
  {
    name: "Kampala — Nakasero",
    code: "KLA-01",
    manager: "Sarah Nabbosa",
    staff: 7,
    parcelsToday: 54,
    revenue: 31600,
    capacity: 44,
    phone: "+256 41 233 770",
  },
];

export const CUSTOMERS = [
  {
    name: "Chanda Mulenga",
    phone: "+260 977 214 880",
    email: "chanda.mulenga@zamtel.zm",
    nrc: "224114/68/1",
    branch: "Lusaka — Cairo Road",
    parcels: 42,
    spend: 7840,
    type: "Business",
    since: "Mar 2024",
  },
  {
    name: "Amina Wanjiru",
    phone: "+254 712 884 021",
    email: "amina.w@safmail.co.ke",
    nrc: "—",
    branch: "Nairobi — Westlands",
    parcels: 31,
    spend: 12400,
    type: "Business",
    since: "Jul 2024",
  },
  {
    name: "Grace Phiri",
    phone: "+260 977 902 118",
    email: "gphiri@gmail.com",
    nrc: "331902/11/1",
    branch: "Kitwe — Obote Avenue",
    parcels: 12,
    spend: 1980,
    type: "Individual",
    since: "Jan 2025",
  },
  {
    name: "Ssemakula Brian",
    phone: "+256 772 445 019",
    email: "brian.s@mtnmail.ug",
    nrc: "—",
    branch: "Kampala — Nakasero",
    parcels: 24,
    spend: 5310,
    type: "Business",
    since: "Sep 2024",
  },
  {
    name: "Mercy Sakala",
    phone: "+260 968 774 512",
    email: "mercy.sakala@outlook.com",
    nrc: "512220/10/1",
    branch: "Livingstone — Mosi-oa-Tunya",
    parcels: 8,
    spend: 940,
    type: "Individual",
    since: "Nov 2025",
  },
  {
    name: "Kondwani Zulu",
    phone: "+260 979 660 145",
    email: "kzulu@zulutrading.zm",
    nrc: "119872/44/1",
    branch: "Lusaka — Kabulonga",
    parcels: 57,
    spend: 15220,
    type: "Corporate",
    since: "Feb 2023",
  },
];

export const STAFF_USERS = [
  {
    name: "Chileshe Mumba",
    email: "chileshe@swiftlogistics.zm",
    role: "Branch Manager",
    branch: "Lusaka — Cairo Road",
    status: "Active",
    lastActive: "2 min ago",
  },
  {
    name: "Natasha Zimba",
    email: "natasha@swiftlogistics.zm",
    role: "Branch Manager",
    branch: "Lusaka — Kabulonga",
    status: "Active",
    lastActive: "18 min ago",
  },
  {
    name: "Emmanuel Daka",
    email: "emmanuel@swiftlogistics.zm",
    role: "Receptionist",
    branch: "Lusaka — Cairo Road",
    status: "Active",
    lastActive: "Just now",
  },
  {
    name: "Patrick Musonda",
    email: "patrick@swiftlogistics.zm",
    role: "Dispatcher",
    branch: "Ndola — Broadway",
    status: "Active",
    lastActive: "1 hr ago",
  },
  {
    name: "Joseph Kunda",
    email: "joseph@swiftlogistics.zm",
    role: "Driver",
    branch: "Ndola — Broadway",
    status: "On Route",
    lastActive: "8 min ago",
  },
  {
    name: "Linda Chirwa",
    email: "linda@swiftlogistics.zm",
    role: "Company Admin",
    branch: "All Branches",
    status: "Active",
    lastActive: "35 min ago",
  },
  {
    name: "Kevin Njoroge",
    email: "kevin@swiftlogistics.zm",
    role: "Branch Manager",
    branch: "Nairobi — Westlands",
    status: "Suspended",
    lastActive: "4 days ago",
  },
  {
    name: "Grace Banda",
    email: "finance@swiftlogistics.zm",
    role: "Finance",
    branch: "Head Office",
    status: "Active",
    lastActive: "12 min ago",
  },
];

export const ROLES = [
  {
    role: "Super Admin",
    scope: "Platform-wide",
    members: 3,
    blurb: "Full control of every workspace, plans, billing and platform health.",
  },
  {
    role: "Company Admin",
    scope: "All branches",
    members: 6,
    blurb: "Manages branches, staff, pricing, integrations and company reports.",
  },
  {
    role: "Branch Manager",
    scope: "Single branch",
    members: 18,
    blurb: "Oversees branch staff, daily reconciliation and outstanding parcels.",
  },
  {
    role: "Receptionist",
    scope: "Front desk",
    members: 47,
    blurb: "Receives parcels, verifies senders, collects payment and prints labels.",
  },
  {
    role: "Dispatcher",
    scope: "Operations",
    members: 21,
    blurb: "Builds manifests, assigns vehicles and drivers, closes dispatch runs.",
  },
  {
    role: "Finance",
    scope: "Head office",
    members: 8,
    blurb: "Payments, invoices, revenue reports and refunds — no operational screens.",
  },
  {
    role: "Driver",
    scope: "Mobile",
    members: 64,
    blurb: "Scans parcels on load, updates transit status and confirms arrival.",
  },
];

export const PERMISSION_MATRIX = [
  { feature: "Register parcels", admin: true, manager: true, reception: true, dispatch: false, driver: false },
  { feature: "Collect payments", admin: true, manager: true, reception: true, dispatch: false, driver: false },
  { feature: "Create dispatch run", admin: true, manager: true, reception: false, dispatch: true, driver: false },
  { feature: "Update transit status", admin: true, manager: true, reception: false, dispatch: true, driver: true },
  { feature: "View branch revenue", admin: true, manager: true, reception: false, dispatch: false, driver: false },
  { feature: "Manage staff & roles", admin: true, manager: false, reception: false, dispatch: false, driver: false },
  { feature: "Company settings & API keys", admin: true, manager: false, reception: false, dispatch: false, driver: false },
];

export const PAYMENTS = [
  { ref: "PMT-88214", customer: "Chanda Mulenga", method: "Airtel Money", amount: 185, status: "Settled", time: "08:22" },
  { ref: "PMT-88215", customer: "Kondwani Zulu", method: "MTN MoMo", amount: 315, status: "Settled", time: "08:51" },
  { ref: "PMT-88216", customer: "Amina Wanjiru", method: "M-Pesa", amount: 410, status: "Settled", time: "10:12" },
  { ref: "PMT-88217", customer: "Grace Phiri", method: "Cash", amount: 240, status: "Pending", time: "11:04" },
  { ref: "PMT-88218", customer: "Thandiwe Moyo", method: "Card", amount: 260, status: "Failed", time: "11:39" },
];

export const ACTIVITIES = [
  { who: "Emmanuel Daka", what: "received parcel POS-249073-ZM at Cairo Road", when: "2 min ago" },
  { who: "Patrick Musonda", what: "dispatched run NDL-RUN-014 with 32 parcels", when: "26 min ago" },
  { who: "Joseph Kunda", what: "marked POS-249071-ZM as In Transit", when: "41 min ago" },
  { who: "Natasha Zimba", what: "reconciled Kabulonga float of ZMW 12,480", when: "1 hr ago" },
  { who: "Linda Chirwa", what: "invited 2 new receptionists to Broadway", when: "2 hrs ago" },
];

export const DISPATCH_RUN = {
  code: "LSK-RUN-041",
  route: "Lusaka — Cairo Road → Ndola — Broadway",
  vehicle: "Toyota Hiace • ABZ 4417",
  driver: "Joseph Kunda",
  driverPhone: "+260 976 440 218",
  departure: "13:30",
  capacity: 60,
  loaded: 38,
};

export type CompanyRecord = {
  name: string;
  country: string;
  branches: number;
  users: number;
  plan: "Starter" | "Professional" | "Enterprise" | "Custom";
  mrr: number;
  status: "Active" | "Trial" | "Expired" | "Suspended" | "Past due" | "Paused" | "Disconnected";
  trial: boolean;
  parcelsToday: number;
  revenue: number;
  storage: string;
  startDate: string;
  expiryDate: string;
  autoRenewal: boolean;
  outstanding: number;
};

export const COMPANIES: CompanyRecord[] = [
  {
    name: "Swift Logistics",
    country: "Zambia",
    branches: 12,
    users: 96,
    plan: "Professional",
    mrr: 34500,
    status: "Active",
    trial: false,
    parcelsToday: 468,
    revenue: 34500,
    storage: "28 GB",
    startDate: "14 Jan 2024",
    expiryDate: "14 Jan 2027",
    autoRenewal: true,
    outstanding: 0,
  },
  {
    name: "Mercury Express",
    country: "Kenya",
    branches: 8,
    users: 61,
    plan: "Professional",
    mrr: 24000,
    status: "Active",
    trial: false,
    parcelsToday: 312,
    revenue: 24000,
    storage: "19 GB",
    startDate: "3 Jun 2024",
    expiryDate: "3 Jun 2027",
    autoRenewal: true,
    outstanding: 0,
  },
  {
    name: "Platinum Courier",
    country: "Uganda",
    branches: 5,
    users: 34,
    plan: "Starter",
    mrr: 9900,
    status: "Trial",
    trial: true,
    parcelsToday: 89,
    revenue: 4200,
    storage: "6 GB",
    startDate: "28 Feb 2026",
    expiryDate: "14 Mar 2026",
    autoRenewal: false,
    outstanding: 0,
  },
  {
    name: "Zambezi Freight",
    country: "Zimbabwe",
    branches: 6,
    users: 41,
    plan: "Starter",
    mrr: 9000,
    status: "Active",
    trial: false,
    parcelsToday: 156,
    revenue: 9000,
    storage: "11 GB",
    startDate: "9 Sep 2025",
    expiryDate: "9 Sep 2026",
    autoRenewal: true,
    outstanding: 0,
  },
  {
    name: "Kilimanjaro Post",
    country: "Tanzania",
    branches: 9,
    users: 72,
    plan: "Enterprise",
    mrr: 48000,
    status: "Past due",
    trial: false,
    parcelsToday: 401,
    revenue: 48000,
    storage: "34 GB",
    startDate: "11 Apr 2023",
    expiryDate: "11 Apr 2026",
    autoRenewal: false,
    outstanding: 48000,
  },
  {
    name: "Accra Runners",
    country: "Ghana",
    branches: 4,
    users: 22,
    plan: "Starter",
    mrr: 9000,
    status: "Suspended",
    trial: false,
    parcelsToday: 0,
    revenue: 0,
    storage: "4 GB",
    startDate: "20 Nov 2025",
    expiryDate: "20 Nov 2026",
    autoRenewal: false,
    outstanding: 18000,
  },
];

export const PLATFORM_KPIS = {
  totalCompanies: 48,
  activeCompanies: 42,
  trialCompanies: 4,
  expiredCompanies: 1,
  suspendedCompanies: 1,
  parcelsToday: 18420,
  totalRevenue: 2840000,
  mrr: 186400,
  totalUsers: 3914,
  uptime: "99.97%",
  storageUsed: "1.2 TB",
  storageLimit: "2 TB",
  smsRemaining: 842000,
  smsUsedThisMonth: 158000,
  smsCost: 4740,
};

export const TICKETS = [
  { id: "SUP-1042", company: "Kilimanjaro Post", subject: "SMS sender ID not delivering", priority: "High", status: "Open", age: "3 h" },
  { id: "SUP-1041", company: "Platinum Courier", subject: "Import 4,200 legacy customers", priority: "Medium", status: "In progress", age: "1 d" },
  { id: "SUP-1039", company: "Mercury Express", subject: "Add M-Pesa till per branch", priority: "Medium", status: "Open", age: "2 d" },
  { id: "SUP-1036", company: "Swift Logistics", subject: "Waybill print alignment on A6", priority: "Low", status: "Resolved", age: "5 d" },
];

export const OPERATIONS_BOARD = {
  waitingVerification: [
    { tracking: "POS-249077-UG", route: "Kampala → Nairobi", run: undefined },
    { tracking: "POS-249081-ZM", route: "Online pre-reg · Cairo Road", run: undefined },
    { tracking: "POS-249082-ZM", route: "Online pre-reg · Kabulonga", run: undefined },
  ],
  readyForDispatch: [
    { tracking: "POS-249073-ZM", route: "Ndola → Chipata", run: undefined },
    { tracking: "POS-249083-ZM", route: "Cairo Road → Kitwe", run: undefined },
    { tracking: "POS-249084-ZM", route: "Kabulonga → Livingstone", run: undefined },
    { tracking: "POS-249085-ZM", route: "Broadway → Cairo Road", run: undefined },
  ],
  inTransit: [
    { tracking: "POS-249071-ZM", route: "Cairo Road → Ndola", run: "LSK-RUN-041 · ABZ 4417" },
    { tracking: "POS-249078-ZM", route: "Chipata → Ndola", run: "CPT-RUN-008 · ABL 2291" },
    { tracking: "POS-249074-KE", route: "Nairobi → Kampala", run: "NBO-RUN-019 · KCB 8812" },
  ],
  readyForCollection: [
    { tracking: "POS-249072-ZM", route: "Kitwe — Obote Avenue", run: undefined },
    { tracking: "POS-249076-ZM", route: "Lusaka — Kabulonga", run: undefined },
    { tracking: "POS-249086-ZM", route: "Ndola — Broadway", run: undefined },
  ],
  delayed: [
    { tracking: "POS-249079-ZM", route: "Livingstone → Chipata · 3 days overdue", run: undefined },
    { tracking: "POS-249080-ZM", route: "Kitwe → Ndola · SLA breach", run: undefined },
  ],
};

export const NOTIFICATIONS = [
  { title: "Parcel ready for collection", body: "POS-249072-ZM arrived at Kitwe — Obote Avenue.", when: "12 min ago", kind: "success" },
  { title: "Payment failed", body: "Card payment PMT-88218 for ZMW 260 was declined.", when: "1 hr ago", kind: "destructive" },
  { title: "Dispatch departed", body: "LSK-RUN-041 left Cairo Road with 38 parcels.", when: "2 hrs ago", kind: "info" },
  { title: "Outstanding parcels", body: "14 parcels have been uncollected for over 7 days.", when: "Today, 07:00", kind: "warning" },
];

export const money = (n: number, currency = "ZMW") =>
  `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const DASHBOARD_STATS = {
  todayParcels: 412,
  waitingDropOff: 18,
  inStock: 286,
  inTransit: 168,
  readyCollection: 214,
  deliveredToday: 297,
  revenueToday: "K 88,420",
  statusBreakdown: [
    { label: "Waiting", count: 18, color: "#3B82F6" },
    { label: "Received", count: 94, color: "#06B6D4" },
    { label: "Dispatched", count: 67, color: "#F59E0B" },
    { label: "Transit", count: 168, color: "#8B5CF6" },
    { label: "Arrived", count: 42, color: "#6366F1" },
    { label: "Collected", count: 297, color: "#10B981" },
  ],
};
