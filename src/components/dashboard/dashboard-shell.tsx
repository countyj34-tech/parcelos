import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChartNoAxesColumn,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gauge,
  HelpCircle,
  LayoutGrid,
  LifeBuoy,
  Menu,
  Moon,
  Package,
  Radar,
  Settings,
  Sparkles,
  Sun,
  Truck,
  Users,
  UsersRound,
} from "lucide-react";
import { CompanyLogo } from "@/components/dashboard/company-logo";
import { TrialBanner } from "@/components/dashboard/trial-banner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceBranch } from "@/hooks/use-workspace-branch";
import { canAccessRoute, DEMO_ROLES, getHomeRouteForRole, getNavForRole, type UserRole } from "@/lib/roles";
import { countUnreadNotifications, onNotificationsChanged } from "@/lib/api/notifications";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Gauge> = {
  Dashboard: Gauge,
  Parcels: Package,
  Customers: UsersRound,
  Reception: Radar,
  Dispatch: Truck,
  Tracking: Sparkles,
  Branches: LayoutGrid,
  Staff: Users,
  Reports: ChartNoAxesColumn,
  Payments: CreditCard,
  Settings: Settings,
  Help: HelpCircle,
};

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useAuth();
  const nav = getNavForRole(role);

  return (
    <nav className="space-y-0.5 px-2 py-3">
      {nav.map((item) => {
        const Icon = ICONS[item.label] ?? Gauge;
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.label}
            to={item.to}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { role, setDemoRole, user, signOut, isDemoMode, companyId, isLoading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);
  const office = useWorkspaceBranch();
  const branchOptions =
    office.branches.length > 0
      ? office.branches.map((b) => b.name)
      : user.branch && user.branch !== "All Branches"
        ? [user.branch]
        : [];
  const [headerQuery, setHeaderQuery] = useState("");

  useEffect(() => {
    if (isDemoMode) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      void countUnreadNotifications().then((n) => {
        if (!cancelled) setUnread(n);
      });
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const unsub = onNotificationsChanged(load);
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      unsub();
    };
  }, [isDemoMode, companyId, user.email, pathname]);

  const switchDemoRole = (next: UserRole) => {
    setDemoRole(next);
    void navigate({ to: getHomeRouteForRole(next) });
  };

  const displayName = isLoading && !isDemoMode ? "…" : user.name;
  const displayInitials = isLoading && !isDemoMode ? "…" : user.initials;

  return (
    <div className="flex min-h-screen w-full bg-surface">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-[240px]",
        )}
      >
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <CompanyLogo collapsed={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav collapsed={collapsed} />
        </div>
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full rounded-xl", collapsed ? "px-0" : "justify-start")}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="mr-2 h-4 w-4" />}
            {!collapsed ? "Collapse" : null}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TrialBanner />
        {/* Top navigation */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0">
                <div className="border-b border-border px-4 py-4">
                  <CompanyLogo />
                </div>
                <SidebarNav onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <Select
              value={office.isAll ? "all" : office.branchName ?? "all"}
              onValueChange={office.setBranch}
            >
              <SelectTrigger className="h-10 w-[200px] rounded-xl text-sm">
                <SelectValue placeholder="Working office" />
              </SelectTrigger>
              <SelectContent>
                {office.canSeeAll ? <SelectItem value="all">All branches</SelectItem> : null}
                {branchOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <form
              className="relative hidden min-w-0 flex-1 md:block md:max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                const q = headerQuery.trim();
                if (!q) return;
                void navigate({
                  to: "/app/reception",
                  search: {
                    q,
                    desk: "dropoff",
                  },
                });
              }}
            >
              <Input
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
                placeholder="Tracking or phone — Enter"
                className="h-10 rounded-xl bg-muted/50"
              />
            </form>

            <div className="ml-auto flex items-center gap-1">
              {isDemoMode ? (
                <Select value={role} onValueChange={(v) => switchDemoRole(v as UserRole)}>
                  <SelectTrigger className="hidden h-9 w-[130px] rounded-xl text-xs xl:flex">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              <Button asChild variant="ghost" size="icon" className="relative">
                <Link to="/app/notifications" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
                  <Bell className="h-4 w-4" />
                  {unread > 0 ? (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 hover:bg-muted">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">{displayInitials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden text-left sm:block">
                      <span className="block text-xs font-semibold">{displayName}</span>
                      <span className="block text-[11px] text-muted-foreground">{role}</span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canAccessRoute(role, "/app/settings") ? (
                    <DropdownMenuItem asChild><Link to="/app/settings">Settings</Link></DropdownMenuItem>
                  ) : null}
                  {canAccessRoute(role, "/app/subscription") ? (
                    <DropdownMenuItem asChild><Link to="/app/subscription">Subscription</Link></DropdownMenuItem>
                  ) : null}
                  {canAccessRoute(role, "/app/support") ? (
                    <DropdownMenuItem asChild><Link to="/app/support">Help</Link></DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
