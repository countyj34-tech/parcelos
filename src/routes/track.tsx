import { createFileRoute } from "@tanstack/react-router";
import { PublicTrackPage } from "@/components/track/public-track-page";

export const Route = createFileRoute("/track")({
  validateSearch: (search: Record<string, unknown>) => {
    const q = typeof search["q"] === "string" ? search["q"] : undefined;
    return q ? { q } : {};
  },
  head: () => ({
    meta: [
      { title: "Track your parcel — ParcelOS" },
      { name: "description", content: "Track a parcel in any browser. No app install required." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { q } = Route.useSearch();
  return <PublicTrackPage initialCode={q ?? ""} />;
}
