import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Flag,
  Globe,
  HardDrive,
  History,
  LayoutGrid,
  LifeBuoy,
  Menu,
  MessageSquare,
  Moon,
  Plug,
  ScrollText,
  Settings,
  Sun,
  User,
  Users,
} from "lucide-react";
import { Logo, PlatformBadge } from "@/components/logo";
import { SecretLogoTap } from "@/components/secret-logo-tap";
import { PwaInstallPrompt } from "@/components/portal/pwa-install-prompt";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_OWNER } from "@/lib/brand";
import { registerServiceWorker } from "@/lib/pwa";
import { cn } from "@/lib/utils";

export type AdminSection =
  | "overview"
  | "companies"
  | "create-company"
  | "company-detail"
  | "subscriptions"
  | "plans"
  | "customers"
  | "platform-users"
  | "domains"
  | "sms"
  | "notifications"
  | "support"
  | "analytics"
  | "billing"
  | "feature-flags"
  | "system-logs"
  | "storage"
  | "integrations"
  | "settings"
  | "audit-logs"
  | "account";

type NavItem = { label: string; section: AdminSection; icon: typeof LayoutGrid; group?: string };

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", section: "overview", icon: LayoutGrid, group: "Home" },
  { label: "Companies", section: "companies", icon: Building2, group: "Home" },
  { label: "Billing", section: "billing", icon: CreditCard, group: "Money" },
  { label: "Plans", section: "plans", icon: LayoutGrid, group: "Money" },
  { label: "Subscriptions", section: "subscriptions", icon: CreditCard, group: "Money" },
  { label: "Customers", section: "customers", icon: Users, group: "Ops" },
  { label: "SMS", section: "sms", icon: MessageSquare, group: "Ops" },
  { label: "Support", section: "support", icon: LifeBuoy, group: "Ops" },
  { label: "Notifications", section: "notifications", icon: Bell, group: "Ops" },
  { label: "Analytics", section: "analytics", icon: BarChart3, group: "Ops" },
  { label: "Domains", section: "domains", icon: Globe, group: "System" },
  { label: "Storage", section: "storage", icon: HardDrive, group: "System" },
  { label: "Flags", section: "feature-flags", icon: Flag, group: "System" },
  { label: "Integrations", section: "integrations", icon: Plug, group: "System" },
  { label: "Platform users", section: "platform-users", icon: User, group: "System" },
  { label: "System logs", section: "system-logs", icon: ScrollText, group: "System" },
  { label: "Audit logs", section: "audit-logs", icon: History, group: "System" },
  { label: "Settings", section: "settings", icon: Settings, group: "System" },
  { label: "My account", section: "account", icon: User, group: "System" },
];

const MOBILE_TABS: Array<{ label: string; section: AdminSection; icon: typeof LayoutGrid }> = [
  { label: "Home", section: "overview", icon: LayoutGrid },
  { label: "Companies", section: "companies", icon: Building2 },
  { label: "Money", section: "billing", icon: CreditCard },
  { label: "Plans", section: "plans", icon: BarChart3 },
];

function buildSearch(section: AdminSection, company?: string) {
  return company ? { section: "company-detail" as const, company } : { section };
}

function AdminNav({
  active,
  collapsed,
  onNavigate,
}: {
  active: AdminSection;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  let lastGroup = "";
  return (
    <nav className="space-y-0.5 px-2 py-3">
      {!collapsed ? (
        <div className="px-3 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{PLATFORM_OWNER}</p>
          <p className="text-xs text-muted-foreground">ParcelOS console</p>
        </div>
      ) : null}
      {ADMIN_NAV.map((item) => {
        const isActive =
          active === item.section ||
          (active === "company-detail" && item.section === "companies") ||
          (active === "create-company" && item.section === "companies");
        const showGroup = !collapsed && item.group && item.group !== lastGroup;
        if (item.group) lastGroup = item.group;
        return (
          <div key={item.section}>
            {showGroup ? (
              <p className="mb-1 mt-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {item.group}
              </p>
            ) : null}
            <Link
              to="/admin"
              search={buildSearch(item.section)}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  children,
  section,
}: {
  children: ReactNode;
  section: AdminSection;
}) {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    registerServiceWorker();
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute("href", "/manifest-admin.webmanifest");
    return () => {
      if (link) link.setAttribute("href", "/manifest.webmanifest");
    };
  }, []);

  const mobileTabActive = (tab: AdminSection) =>
    section === tab ||
    (tab === "companies" && (section === "company-detail" || section === "create-company")) ||
    (tab === "billing" && (section === "subscriptions" || section === "billing"));

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:flex",
          collapsed ? "w-[68px]" : "w-[252px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          {collapsed ? (
            <SecretLogoTap>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                M
              </span>
            </SecretLogoTap>
          ) : (
            <div>
              <Logo labelClassName="text-[15px]" />
              <PlatformBadge className="mt-0.5" />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminNav active={section} collapsed={collapsed} />
        </div>
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full rounded-lg", collapsed && "px-0")}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 lg:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100%,300px)] p-0">
                <div className="border-b border-border px-4 py-4">
                  <Logo />
                  <PlatformBadge className="mt-1" />
                </div>
                <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto">
                  <AdminNav active={section} onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1 lg:hidden">
              <p className="truncate text-sm font-bold">ParcelOS</p>
              <p className="truncate text-[11px] text-muted-foreground">{PLATFORM_OWNER}</p>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl" onClick={toggle} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button asChild variant="ghost" size="icon" className="relative h-11 w-11 rounded-xl">
                <Link to="/admin" search={{ section: "notifications" }} aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-11 items-center gap-2 rounded-xl border border-border px-2 hover:bg-muted">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-left text-xs sm:block">
                      <span className="block font-semibold">{user.name}</span>
                      <span className="text-muted-foreground">Owner</span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin" search={{ section: "account" }}>
                      My account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin" search={{ section: "audit-logs" }}>
                      Audit logs
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 pb-24 pt-4 sm:px-4 sm:pt-6 lg:px-8 lg:pb-8 lg:py-8">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>

        {/* Phone-first bottom dock */}
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1 py-1.5">
            {MOBILE_TABS.map((tab) => {
              const on = mobileTabActive(tab.section);
              return (
                <Link
                  key={tab.section}
                  to="/admin"
                  search={buildSearch(tab.section)}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold",
                    on ? "bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  <tab.icon className="h-5 w-5" />
                  {tab.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold text-muted-foreground"
            >
              <Menu className="h-5 w-5" />
              More
            </button>
          </div>
        </nav>

        <PwaInstallPrompt
          title="ParcelOS Console"
          description="Install on your phone — check companies, billing, and kill-switch from the home screen."
        />
      </div>
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export { Activity, Building2, FileText, HardDrive, Users };
