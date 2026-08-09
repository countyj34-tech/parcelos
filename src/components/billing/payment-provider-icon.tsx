import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  mtn: "#FFCC00",
  airtel: "#E60000",
  zamtel: "#00A651",
  uba: "#D21034",
  access: "#003883",
};

/** Brand payment icons for Zambia MoMo + banks */
export function PaymentProviderIcon({
  provider,
  className,
  size = 40,
}: {
  provider: string;
  className?: string;
  size?: number;
}) {
  const key = provider.toLowerCase();
  const bg = COLORS[key] ?? "#0F766E";

  if (key === "mtn") {
    return (
      <span
        className={cn("inline-grid place-items-center rounded-xl font-black text-black shadow-sm", className)}
        style={{ width: size, height: size, background: bg, fontSize: size * 0.28 }}
        title="MTN Mobile Money"
      >
        MTN
      </span>
    );
  }

  if (key === "airtel") {
    return (
      <span
        className={cn("inline-grid place-items-center rounded-xl font-bold text-white shadow-sm", className)}
        style={{ width: size, height: size, background: bg, fontSize: size * 0.22 }}
        title="Airtel Money"
      >
        airtel
      </span>
    );
  }

  if (key === "zamtel") {
    return (
      <span
        className={cn("inline-grid place-items-center rounded-xl font-bold text-white shadow-sm", className)}
        style={{ width: size, height: size, background: bg, fontSize: size * 0.2 }}
        title="Zamtel Kwacha"
      >
        Zamtel
      </span>
    );
  }

  if (key === "uba") {
    return (
      <span
        className={cn("inline-grid place-items-center rounded-xl font-black text-white shadow-sm", className)}
        style={{ width: size, height: size, background: bg, fontSize: size * 0.32 }}
        title="UBA Bank"
      >
        UBA
      </span>
    );
  }

  if (key === "access") {
    return (
      <span
        className={cn("inline-grid place-items-center rounded-xl font-bold text-white shadow-sm", className)}
        style={{ width: size, height: size, background: bg, fontSize: size * 0.18 }}
        title="Access Bank"
      >
        Access
      </span>
    );
  }

  return (
    <span
      className={cn("inline-grid place-items-center rounded-xl text-xs font-bold text-white shadow-sm", className)}
      style={{ width: size, height: size, background: bg }}
      title={provider}
    >
      {provider.slice(0, 3).toUpperCase()}
    </span>
  );
}
