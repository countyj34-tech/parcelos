import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { notifyParcelStakeholders, type NotifyEvent } from "@/lib/api/messaging";
import { fetchParcelByTracking, fetchParcelTrackingEvents, fetchParcels } from "@/lib/api/parcels";
import type { Parcel, ParcelStatus } from "@/lib/types/parcel";

const UI_TO_DB_STATUS: Record<string, string> = {
  "Waiting for Drop-off": "waiting_for_dropoff",
  Received: "received",
  Dispatched: "dispatched",
  "In Transit": "in_transit",
  Arrived: "at_destination_branch",
  "Ready for Collection": "ready_for_collection",
  Collected: "collected",
  Returned: "returned",
  Delay: "in_transit",
  Lost: "cancelled",
  Cancelled: "cancelled",
};

export const TRACKING_STATUSES: ParcelStatus[] = [
  "Waiting for Drop-off",
  "Received",
  "Dispatched",
  "In Transit",
  "Arrived",
  "Ready for Collection",
  "Collected",
];

export type TrackingEvent = {
  title: string;
  description: string | null;
  occurred_at: string;
  status: string;
  location_label?: string | null;
};

export type TrackingNotify = {
  parcel_id: string;
  tracking: string;
  status?: string;
  from_status?: string;
  to_status?: string;
  title: string;
  description?: string | null;
  receiver_phone: string | null;
  sender_phone: string | null;
  notify_event: string | null;
  dest_city?: string | null;
};

async function client() {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not available");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in required");
  return supabase;
}

export async function searchParcelForTracking(query: string): Promise<Parcel | null> {
  const q = query.trim();
  if (!q) return null;
  const exact = await fetchParcelByTracking(q);
  if (exact) return exact;
  const rows = await fetchParcels({ search: q });
  return rows[0] ?? null;
}

export async function fetchStaffTrackingEvents(tracking: string): Promise<TrackingEvent[]> {
  const events = await fetchParcelTrackingEvents(tracking);
  return (events as TrackingEvent[]) ?? [];
}

export function dbStatusFromUi(label: string, note?: string): { status: string; note?: string } {
  const status = UI_TO_DB_STATUS[label] ?? "in_transit";
  if (label === "Delay") return { status, note: note?.trim() || "Delay reported on the route." };
  if (label === "Lost") return { status, note: note?.trim() || "Marked lost — follow up with operations." };
  return note ? { status, note } : { status };
}

export async function updateParcelTrackingStatus(input: {
  parcelId: string;
  companyId: string;
  uiStatus: string;
  note?: string;
  notifyReceiver?: boolean;
}): Promise<TrackingNotify> {
  const supabase = await client();
  const mapped = dbStatusFromUi(input.uiStatus, input.note);

  const { data, error } = await supabase.rpc("staff_update_parcel_status", {
    p_parcel_id: input.parcelId,
    p_status: mapped.status,
    p_note: mapped.note ?? (input.note?.trim() || null),
    p_location_label: null,
  });

  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as TrackingNotify | undefined;
  if (!row?.parcel_id) throw new Error("Status did not save");

  if (input.notifyReceiver) {
    await sendTrackingNotices(input.companyId, {
      ...row,
      title: row.title || input.uiStatus,
      notify_event: row.notify_event,
    });
  }

  return row;
}

export async function startDispatchRun(driverId?: string | null, vehicleId?: string | null): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("start_dispatch_run", {
    p_driver_id: driverId || null,
    p_vehicle_id: vehicleId || null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not start live trip");
  return data as string;
}

export async function stopDispatchRun(runId?: string | null): Promise<void> {
  const supabase = await client();
  const { error } = await supabase.rpc("stop_dispatch_run", {
    p_run_id: runId || null,
  });
  if (error) throw new Error(error.message);
}

export async function reportRunLocation(input: {
  lat: number;
  lng: number;
  companyId: string;
  driverId?: string | null;
  accuracyM?: number | null;
  runId?: string | null;
}): Promise<TrackingNotify[]> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("report_run_location", {
    p_lat: input.lat,
    p_lng: input.lng,
    p_driver_id: input.driverId || null,
    p_accuracy_m: input.accuracyM ?? null,
    p_run_id: input.runId || null,
  });
  if (error) throw new Error(error.message);
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as TrackingNotify[];
  for (const row of rows) {
    await sendTrackingNotices(input.companyId, row);
  }
  return rows;
}

function notifyKind(event: string | null | undefined): NotifyEvent | null {
  if (event === "receive" || event === "dispatch" || event === "ready") return event;
  if (event === "transit" || event === "city") return "transit";
  if (event === "arrived") return "arrived";
  return null;
}

function messageFor(row: TrackingNotify): string {
  const t = row.tracking;
  switch (row.notify_event) {
    case "transit":
      return `Your parcel ${t} is in transit to the destination office.`;
    case "city":
      return `Your parcel ${t} has reached ${row.dest_city || "the destination city"} and is heading to the courier office.`;
    case "arrived":
      return `Your parcel ${t} has arrived at the destination courier office.`;
    case "ready":
      return `Your parcel ${t} is ready for collection. Please bring ID.`;
    case "dispatch":
      return `Your parcel ${t} has been dispatched and is on the way.`;
    case "receive":
      return `Your parcel ${t} has been received at the counter.`;
    default:
      return row.description || `Update on parcel ${t}: ${row.title}.`;
  }
}

export async function sendTrackingNotices(companyId: string, row: TrackingNotify): Promise<void> {
  const event = notifyKind(row.notify_event);
  if (!event) return;
  const message = messageFor(row);
  const phones = [row.receiver_phone, row.sender_phone].filter((p, i, arr) => p && arr.indexOf(p) === i);
  for (const phone of phones) {
    void notifyParcelStakeholders({
      companyId,
      parcelId: row.parcel_id,
      event,
      phone,
      message,
    });
  }
}
