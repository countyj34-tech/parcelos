import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/use-tenant";
import { DEMO_TENANT } from "@/lib/tenant";

export const Route = createFileRoute("/app/support")({
  head: () => ({ meta: [{ title: "Help — ParcelOS" }] }),
  component: HelpPage,
});

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function telHref(phone: string) {
  return `tel:${phone.replace(/\s/g, "")}`;
}

function waHref(phone: string) {
  const digits = digitsOnly(phone);
  if (digits.length < 9) return null;
  const intl = digits.startsWith("260")
    ? digits
    : digits.startsWith("0")
      ? `260${digits.slice(1)}`
      : digits;
  return `https://wa.me/${intl}`;
}

function HelpPage() {
  const { tenant } = useTenant();
  const isDemo = tenant.id === DEMO_TENANT.id || tenant.slug === DEMO_TENANT.slug;
  const phone = tenant.supportPhone.trim();
  const email = tenant.supportEmail.trim();
  const showDemoContact = isDemo && (phone || email);
  const whatsapp = phone ? waHref(phone) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help"
        description={`${tenant.name} support contacts`}
        actions={
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/app/settings">
              <Settings2 className="mr-2 h-4 w-4" /> Edit in Settings
            </Link>
          </Button>
        }
      />

      {!phone && !email ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8">
          <p className="text-lg font-semibold">No support contacts saved yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your company phone and email in Settings → Logo &amp; theme. Help, the customer portal,
            and receipts will use those — not placeholder numbers.
          </p>
          <Button asChild className="mt-5 rounded-xl">
            <Link to="/app/settings">Add phone and email</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {phone ? (
            <a
              href={telHref(phone)}
              className="rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">Call {tenant.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{phone}</p>
            </a>
          ) : null}

          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">WhatsApp</h2>
              <p className="mt-1 text-sm text-muted-foreground">{phone}</p>
            </a>
          ) : null}

          {email ? (
            <a
              href={`mailto:${email}`}
              className="rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">Email</h2>
              <p className="mt-1 text-sm text-muted-foreground">{email}</p>
            </a>
          ) : null}
        </div>
      )}

      {showDemoContact ? (
        <p className="text-xs text-muted-foreground">Demo workspace — replace these in Settings before going live.</p>
      ) : null}
    </div>
  );
}
