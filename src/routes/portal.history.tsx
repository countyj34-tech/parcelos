import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyPortalParcels } from "@/lib/api/parcels";
import { money } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Parcel } from "@/lib/types/parcel";

export const Route = createFileRoute("/portal/history")({
  head: () => ({
    meta: [
      { title: "Parcel history — Customer portal" },
      { name: "description", content: "Every parcel you have sent, with status, branch and fees." },
      { property: "og:title", content: "Parcel history" },
      { property: "og:description", content: "Your parcel history with this courier." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { isAuthenticated, isLoading: authLoading, isDemoMode } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authLoading) return;
      if (!isSupabaseConfigured() || isDemoMode || !isAuthenticated) {
        if (!cancelled) {
          setParcels([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const rows = await fetchMyPortalParcels();
      if (!cancelled) {
        setParcels(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, isDemoMode]);

  if (authLoading || loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated && !isDemoMode) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-3xl font-bold">Parcel history</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your customer account to see parcels linked to your phone number.
        </p>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/portal/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Parcel history</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {parcels.length
          ? `${parcels.length} parcel${parcels.length === 1 ? "" : "s"} on your account`
          : "No parcels yet — send one from Register or ask reception to link your number."}
      </p>

      <div className="card-elevated mt-6 overflow-hidden p-0">
        {parcels.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nothing here yet.{" "}
            <Link to="/portal/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Send a parcel
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Tracking</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcels.map((p) => (
                  <TableRow key={p.tracking} className="transition-colors">
                    <TableCell className="font-medium">
                      <Link
                        to="/portal/track"
                        search={{ q: p.tracking }}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {p.tracking}
                      </Link>
                    </TableCell>
                    <TableCell>{p.receiver}</TableCell>
                    <TableCell className="text-muted-foreground">{p.destination}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{p.created}</TableCell>
                    <TableCell>{money(p.amount)}</TableCell>
                    <TableCell>
                      <StatusPill status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
