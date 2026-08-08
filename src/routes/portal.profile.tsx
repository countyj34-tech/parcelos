import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/portal/profile")({
  head: () => ({
    meta: [
      { title: "My profile — ParcelOS customer portal" },
      { name: "description", content: "Manage your contact details, ID and notification preferences." },
      { property: "og:title", content: "My profile — ParcelOS" },
      { property: "og:description", content: "Manage your details and notification preferences." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Profile</h1>

      <div className="card-elevated p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary text-lg text-primary-foreground">CM</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">Chanda Mulenga</p>
            <p className="truncate text-sm text-muted-foreground">
              Business customer · Lusaka — Cairo Road
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {[
            ["Full name", "Chanda Mulenga"],
            ["Phone number", "+260 977 214 880"],
            ["Email", "chanda.mulenga@zamtel.zm"],
            ["NRC", "224114/68/1"],
            ["Home branch", "Lusaka — Cairo Road"],
            ["Preferred payment", "Airtel Money"],
          ].map(([label, value]) => (
            <div key={label} className="space-y-2">
              <Label>{label}</Label>
              <Input defaultValue={value} className="h-11 rounded-xl" />
            </div>
          ))}
        </div>
        <Button className="mt-6 rounded-full">Save changes</Button>
      </div>

      <div className="card-elevated p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Notification preferences</h2>
        <div className="mt-5 divide-y divide-border">
          {[
            ["SMS updates", "Status changes sent to +260 977 214 880", true],
            ["WhatsApp updates", "Rich updates with tracking link", true],
            ["Email receipts", "Payment receipts and monthly statements", false],
          ].map(([title, desc, on]) => (
            <div
              key={title as string}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch defaultChecked={on as boolean} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
