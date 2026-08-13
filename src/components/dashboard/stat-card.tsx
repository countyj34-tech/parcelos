import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-card", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={accent ? { background: `${accent}18`, color: accent } : undefined}
          >
            <Icon className={cn("h-4 w-4", !accent && "text-primary")} />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export function StatusCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{count}</p>
    </div>
  );
}
