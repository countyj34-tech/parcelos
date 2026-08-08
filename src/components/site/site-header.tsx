import { Link } from "@tanstack/react-router";
import { Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CompanyBrand } from "@/components/site/company-brand";
import { useTheme } from "@/hooks/use-theme";

const links = [
  { label: "Operations", href: "/#features" },
  { label: "Insights", href: "/#insights" },
  { label: "Help", href: "/#faq" },
];

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const { theme, toggle } = useTheme();

  return (
    <header
      className={
        transparent
          ? "absolute inset-x-0 top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-md"
          : "sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl"
      }
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 lg:px-8">
        <div className="flex min-w-0 items-center gap-9">
          <CompanyBrand inverted={transparent} />
          <nav className="hidden items-center gap-7 lg:flex">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className={
                  transparent
                    ? "text-sm font-medium text-white/80 transition-colors hover:text-white"
                    : "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
            className={transparent ? "text-white hover:bg-white/10 hover:text-white" : undefined}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            asChild
            variant="ghost"
            className={transparent ? "hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex" : "hidden sm:inline-flex"}
          >
            <Link to="/track">Track parcel</Link>
          </Button>
          <Button asChild className="hidden rounded-full sm:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={transparent ? "border-white/20 bg-white/10 text-white lg:hidden" : "lg:hidden"}
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-8 flex flex-col gap-1">
                {links.map((l) => (
                  <a key={l.label} href={l.href} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted">
                    {l.label}
                  </a>
                ))}
                <Link to="/track" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted">
                  Track parcel
                </Link>
                <Link to="/login" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted">
                  Sign in
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
