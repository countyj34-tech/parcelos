import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OPERATIONS_BOARD } from "@/lib/mock-data";

const COLUMNS = [
  {
    key: "waitingVerification" as const,
    label: "Waiting verification",
    icon: Clock,
    color: "border-blue-500/30 bg-blue-500/5",
    dot: "bg-blue-500",
    description: "Pre-registered online, awaiting branch check-in",
  },
  {
    key: "readyForDispatch" as const,
    label: "Ready for dispatch",
    icon: Package,
    color: "border-amber-500/30 bg-amber-500/5",
    dot: "bg-amber-500",
    description: "Received and paid — load onto next run",
  },
  {
    key: "inTransit" as const,
    label: "In transit",
    icon: Truck,
    color: "border-violet-500/30 bg-violet-500/5",
    dot: "bg-violet-500",
    description: "Vehicles currently on the road",
  },
  {
    key: "readyForCollection" as const,
    label: "Ready for collection",
    icon: CheckCircle2,
    color: "border-emerald-500/30 bg-emerald-500/5",
    dot: "bg-emerald-500",
    description: "Arrived at destination branch",
  },
  {
    key: "delayed" as const,
    label: "Needs attention",
    icon: AlertTriangle,
    color: "border-red-500/30 bg-red-500/5",
    dot: "bg-red-500",
    description: "Delayed or overdue parcels",
  },
];

export function OperationsCenter() {
  return (
    <section className="card-elevated overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold">Operations Center</h2>
          <p className="text-sm text-muted-foreground">
            Live board — spot bottlenecks before they become queues
          </p>
        </div>
        <Link
          to="/app/parcels"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          All parcels <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-0 divide-y divide-border lg:grid-cols-5 lg:divide-x lg:divide-y-0">
        {COLUMNS.map((col) => {
          const items = OPERATIONS_BOARD[col.key];
          const Icon = col.icon;
          return (
            <div key={col.key} className={cn("flex flex-col", col.color)}>
              <div className="border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {col.label}
                  </span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold">{items.length}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {col.description}
                </p>
              </div>
              <ul className="max-h-48 flex-1 space-y-0 overflow-y-auto">
                {items.map((item) => (
                  <li
                    key={item.tracking}
                    className="border-b border-border/40 px-4 py-2.5 last:border-0"
                  >
                    <p className="truncate text-xs font-semibold">{item.tracking}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.route}
                    </p>
                    {"run" in item && item.run ? (
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80">
                        {item.run}
                      </p>
                    ) : null}
                  </li>
                ))}
                {items.length === 0 ? (
                  <li className="px-4 py-6 text-center text-[11px] text-muted-foreground">
                    None right now
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
