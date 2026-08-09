import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy join URL → company home. */
export const Route = createFileRoute("/join")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
