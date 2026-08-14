import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isSuperAdminPatternUnlocked } from "@/lib/super-admin-unlock";

/** Legacy route — SaaS console opens directly after pattern (no login screen). */
export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: PlatformRedirect,
});

function PlatformRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isSuperAdminPatternUnlocked()) {
      void navigate({
        to: "/admin",
        search: { section: "overview", company: undefined },
        replace: true,
      });
      return;
    }
    void navigate({ to: "/", replace: true });
  }, [navigate]);

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-950 text-sm text-white/70">
      Opening SaaS console…
    </div>
  );
}
