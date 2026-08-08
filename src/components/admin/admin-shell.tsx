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
  Search,
  Settings,
  Sun,
  User,
  Users,
} from "lucide-react";
import { Logo, PlatformBadge } from "@/components/logo";
import { SecretLogoTap } from "@/components/secret-logo-tap";
import { PwaInstallPrompt } from "@/components/portal/pwa-install-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type NavItem = { label: string; section: AdminSection; icon: typeof LayoutGrid };

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", section: "overview", icon: LayoutGrid },
  { label: "Courier Companies", section: "companies", icon: Building2 },
  { label: "Subscriptions", section: "subscriptions", icon: CreditCard },
  { label: "Plans", section: "plans", icon: LayoutGrid },
  { label: "Customers", section: "customers", icon: Users },
  { label: "Platform Users", section: "platform-users", icon: User },
  { label: "Domains", section: "domains", icon: Globe },
  { label: "SMS Center", section: "sms", icon: MessageSquare },
  { label: "Notifications", section: "notifications", icon: Bell },
  { label: "Support Center", section: "support", icon: LifeBuoy },
  { label: "Analytics", section: "analytics", icon: BarChart3 },
  { label: "Billing", section: "billing", icon: CreditCard },
  { label: "Feature Flags", section: "feature-flags", icon: Flag },
  { label: "System Logs", section: "system-logs", icon: ScrollText },
  { label: "Storage", section: "storage", icon: HardDrive },
  { label: "Integrations", section: "integrations", icon: Plug },
  { label: "Platform Settings", section: "settings", icon: Settings },
  { label: "Audit Logs", section: "audit-logs", icon: History },
  { label: "My Account", section: "account", icon: User },
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
  return (
    <nav className="space-y-0.5 px-2 py-3">
      {!collapsed ? (
        <div className="px-3 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{PLATFORM_OWNER}</p>
          <p className="text-xs text-muted-foreground">ParcelOS Platform Console</p>
        </div>
      ) : null}
      {ADMIN_NAV.map((item) => {
        const isActive = active === item.section || (active === "company-detail" && item.section === "companies") || (active === "create-company" && item.section === "companies");
        return (
          <Link
            key={item.section}
            to="/admin"
            search={buildSearch(item.section)}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </Link>
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

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:flex", collapsed ? "w-[68px]" : "w-[252px]")}>
        <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
          {collapsed ? (
            <SecretLogoTap>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">M</span>
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
          <Button variant="ghost" size="sm" className={cn("w-full rounded-lg", collapsed && "px-0")} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="mr-2 h-4 w-4" />Collapse</>}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden"><Menu className="h-4 w-4" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0">
                <div className="border-b border-border px-4 py-4"><Logo /><PlatformBadge className="mt-1" /></div>
                <AdminNav active={section} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="relative hidden min-w-0 flex-1 md:block md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search companies, users, tickets…" className="h-9 rounded-lg bg-muted/50 pl-9 text-sm" />
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button asChild variant="ghost" size="icon" className="relative">
                <Link to="/admin" search={{ section: "notifications" }}><Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" /></Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 hover:bg-muted">
                    <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{user.initials}</AvatarFallback></Avatar>
                    <span className="hidden text-left text-xs sm:block"><span className="block font-semibold">{user.name}</span><span className="text-muted-foreground">Platform Owner</span></span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/admin" search={{ section: "account" }}>My account</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/admin" search={{ section: "audit-logs" }}>Audit logs</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
        <PwaInstallPrompt
          title="ParcelOS Console"
          description="Install on this device — Super Admin stays unlocked here."
        />
      </div>
    </div>
  );
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export { Activity, Building2, FileText, HardDrive, Users };
