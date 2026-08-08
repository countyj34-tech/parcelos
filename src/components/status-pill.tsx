import { cn } from "@/lib/utils";
import type { ParcelStatus } from "@/lib/mock-data";

const STATUS_STYLES: Record<string, string> = {
  "Waiting for Drop-off": "bg-muted text-muted-foreground border-border",
  Received: "bg-info/10 text-info border-info/25",
  Dispatched: "bg-accent/15 text-accent-foreground border-accent/30",
  "In Transit": "bg-primary/10 text-primary border-primary/25",
  Arrived: "bg-warning/15 text-warning-foreground border-warning/30",
  "Ready for Collection": "bg-success/12 text-success border-success/25",
  Collected: "bg-success/15 text-success border-success/30",
  Paid: "bg-success/12 text-success border-success/25",
  Unpaid: "bg-destructive/10 text-destructive border-destructive/25",
  "Cash on Collection": "bg-warning/15 text-warning-foreground border-warning/30",
  Settled: "bg-success/12 text-success border-success/25",
  Pending: "bg-warning/15 text-warning-foreground border-warning/30",
  Failed: "bg-destructive/10 text-destructive border-destructive/25",
  Active: "bg-success/12 text-success border-success/25",
  Trial: "bg-info/10 text-info border-info/25",
  "Past due": "bg-destructive/10 text-destructive border-destructive/25",
  Suspended: "bg-destructive/10 text-destructive border-destructive/25",
  "On Route": "bg-primary/10 text-primary border-primary/25",
};

export function StatusPill({
  status,
  className,
}: {
  status: ParcelStatus | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
