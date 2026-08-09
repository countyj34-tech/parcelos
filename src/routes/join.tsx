import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy join URL → create account. */
export const Route = createFileRoute("/join")({
  beforeLoad: () => {
    throw redirect({ to: "/signup" });
  },
});
