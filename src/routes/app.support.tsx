import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, MessageSquare, Phone, Ticket, Video } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/support")({
  head: () => ({ meta: [{ title: "Help — ParcelOS" }] }),
  component: HelpPage,
});

const ITEMS = [
  { icon: BookOpen, title: "Help center", desc: "Guides for reception, dispatch and admin." },
  { icon: Video, title: "Video tutorials", desc: "Short walkthroughs for every module." },
  { icon: BookOpen, title: "Documentation", desc: "Full operator handbook and API docs." },
  { icon: MessageSquare, title: "Contact support", desc: "Chat with our team Mon–Sat, 07:00–21:00." },
  { icon: Ticket, title: "Submit ticket", desc: "Report a bug or request a feature." },
  { icon: Phone, title: "Priority line", desc: "+260 211 234 590 for urgent issues." },
];

function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Help" description="Get support when you need it" actions={<Button className="rounded-xl"><Ticket className="mr-2 h-4 w-4" /> Submit ticket</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <button
            key={item.title}
            type="button"
            className="rounded-2xl border border-border bg-card p-6 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
