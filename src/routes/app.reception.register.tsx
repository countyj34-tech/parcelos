import { createFileRoute, redirect } from "@tanstack/react-router";

/** Staff shortcut — opens the register wizard and returns to reception on Back. */
export const Route = createFileRoute("/app/reception/register")({
  beforeLoad: () => {
    throw redirect({
      to: "/portal/register",
      search: { from: "reception" },
    });
  },
});
