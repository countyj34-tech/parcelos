import {
  CheckCircle2,
  Clock,
  Handshake,
  MapPin,
  PackageCheck,
  PackageSearch,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const PARCEL_TIMELINE_STEPS = [
  { label: "Waiting for Drop-off", icon: Clock },
  { label: "Received", icon: PackageCheck },
  { label: "Dispatched", icon: Warehouse },
  { label: "In Transit", icon: Truck },
  { label: "Arrived", icon: MapPin },
  { label: "Ready for Collection", icon: PackageSearch },
  { label: "Collected", icon: Handshake },
] as const;

export type TimelineStep = {
  label: string;
  icon: LucideIcon;
  time: string;
  detail: string;
};

export function ParcelTimeline({
  steps,
  currentIndex,
  className,
}: {
  steps: TimelineStep[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const Icon = step.icon;

        return (
          <li key={step.label} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition-all duration-300",
                  done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  active && "border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-[var(--tenant-primary-fg)] shadow-md",
                  !done && !active && "border-border bg-muted/60 text-muted-foreground",
                )}
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-[18px] w-[18px]" />}
              </span>
              {i < steps.length - 1 ? (
                <span
                  className={cn("my-1.5 w-0.5 flex-1 min-h-[28px] rounded-full", done ? "bg-emerald-500/35" : "bg-border")}
                />
              ) : null}
            </div>
            <div className={cn("pb-8 pt-1", !done && !active && "opacity-55")}>
              <p className={cn("text-[15px] font-semibold", active && "text-foreground")}>{step.label}</p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{step.time}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
