import { createFileRoute } from "@tanstack/react-router";
import { PublicTrackPage } from "@/components/track/public-track-page";

export const Route = createFileRoute("/t/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Track ${params.code} — ParcelOS` },
      {
        name: "description",
        content: `Live parcel tracking for ${params.code}. Opens in any browser — no app install.`,
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PublicTrackingByCode,
});

function PublicTrackingByCode() {
  const { code } = Route.useParams();
  return <PublicTrackPage initialCode={decodeURIComponent(code)} />;
}
