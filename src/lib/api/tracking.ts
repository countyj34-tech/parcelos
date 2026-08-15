import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { coordsForCity, distanceM } from "@/lib/geo-zm";
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

function rpcMissing(message: string) {
  return /does not exist|schema cache|PGRST202|could not find/i.test(message);
}

const STATUS_META: Record<string, { title: string; notify: string | null; description: string }> = {
  waiting_for_dropoff: { title: "Waiting for Drop-off", notify: null, description: "Reference created." },
  received: { title: "Received", notify: "receive", description: "Verified at the counter." },
  dispatched: { title: "Dispatched", notify: "dispatch", description: "Loaded and left the origin branch." },
  in_transit: { title: "In Transit", notify: "transit", description: "Parcel is on the road to the destination office." },
  at_destination_branch: { title: "Arrived", notify: "arrived", description: "Parcel has arrived at the destination courier office." },
  ready_for_collection: { title: "Ready for Collection", notify: "ready", description: "Parcel is ready. Receiver can collect with ID." },
  collected: { title: "Collected", notify: "ready", description: "Handed over to the receiver." },
  returned: { title: "Returned", notify: null, description: "Returned." },
  cancelled: { title: "Cancelled", notify: null, description: "Cancelled." },
};

export async function updateParcelTrackingStatus(input: {
  parcelId: string;
  companyId: string;
  uiStatus: string;
  note?: string;
  notifyReceiver?: boolean;
}): Promise<TrackingNotify> {
  const supabase = await client();
  const mapped = dbStatusFromUi(input.uiStatus, input.note);
  const note = mapped.note ?? (input.note?.trim() || null);

  const { data, error } = await supabase.rpc("staff_update_parcel_status", {
    p_parcel_id: input.parcelId,
    p_status: mapped.status,
    p_note: note,
    p_location_label: null,
  });

  let row = (Array.isArray(data) ? data[0] : data) as TrackingNotify | undefined;
  if (error || !row?.parcel_id) {
    if (error && !rpcMissing(error.message)) throw new Error(error.message);
    row = await writeParcelStatusDirect({
      parcelId: input.parcelId,
      companyId: input.companyId,
      status: mapped.status,
      note,
    });
  }

  if (input.notifyReceiver) {
    await sendTrackingNotices(input.companyId, {
      ...row,
      title: row.title || input.uiStatus,
      notify_event: row.notify_event,
    });
  }

  return row;
}

async function writeParcelStatusDirect(input: {
  parcelId: string;
  companyId: string;
  status: string;
  note: string | null;
}): Promise<TrackingNotify> {
  const supabase = await client();
  const meta = STATUS_META[input.status] ?? {
    title: input.status,
    notify: "transit" as string | null,
    description: input.status,
  };
  const description = input.note || meta.description;

  const { data: parcel, error: loadError } = await supabase
    .from("parcels")
    .select("id, tracking_number, receiver_phone, sender_phone, destination_branch_id")
    .eq("id", input.parcelId)
    .maybeSingle();
  if (loadError || !parcel) throw new Error(loadError?.message || "Parcel not found");

  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.status === "at_destination_branch" || input.status === "ready_for_collection" || input.status === "collected") {
    patch.current_branch_id = parcel.destination_branch_id;
  }
  if (input.status === "ready_for_collection") patch.ready_at = new Date().toISOString();
  if (input.status === "collected") patch.collected_at = new Date().toISOString();
  if (input.status === "dispatched" || input.status === "in_transit") {
    patch.dispatched_at = new Date().toISOString();
  }

  const { error: upError } = await supabase.from("parcels").update(patch).eq("id", input.parcelId);
  if (upError) throw new Error(upError.message);

  await supabase.from("parcel_tracking").insert({
    company_id: input.companyId,
    parcel_id: input.parcelId,
    status: input.status,
    title: meta.title,
    description,
    occurred_at: new Date().toISOString(),
    is_public: true,
  });

  return {
    parcel_id: String(parcel.id),
    tracking: String(parcel.tracking_number),
    status: input.status,
    title: meta.title,
    description,
    receiver_phone: (parcel.receiver_phone as string | null) ?? null,
    sender_phone: (parcel.sender_phone as string | null) ?? null,
    notify_event: meta.notify,
  };
}

export async function startDispatchRun(driverId?: string | null, vehicleId?: string | null): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("start_dispatch_run", {
    p_driver_id: driverId || null,
    p_vehicle_id: vehicleId || null,
  });
  if (!error && data) return data as string;
  if (error && !rpcMissing(error.message)) throw new Error(error.message);
  return `local-${crypto.randomUUID()}`;
}

export async function stopDispatchRun(runId?: string | null): Promise<void> {
  const supabase = await client();
  const { error } = await supabase.rpc("stop_dispatch_run", {
    p_run_id: runId || null,
  });
  if (error && !rpcMissing(error.message) && !String(runId ?? "").startsWith("local-")) {
    throw new Error(error.message);
  }
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
  if (!error) {
    const rows = (Array.isArray(data) ? data : data ? [data] : []) as TrackingNotify[];
    for (const row of rows) {
      await sendTrackingNotices(input.companyId, row);
    }
    return rows;
  }
  if (!rpcMissing(error.message)) throw new Error(error.message);
  const rows = await reportRunLocationDirect(input);
  for (const row of rows) {
    await sendTrackingNotices(input.companyId, row);
  }
  return rows;
}

type BranchGeo = { name: string | null; city: string | null; latitude: number | null; longitude: number | null };

function pointForBranch(b: BranchGeo | null | undefined): { lat: number; lng: number; city: string } | null {
  if (!b) return null;
  const city = (b.city ?? b.name ?? "").trim();
  const fallback = coordsForCity(city) ?? coordsForCity(b.name);
  const lat = b.latitude != null ? Number(b.latitude) : fallback?.lat;
  const lng = b.longitude != null ? Number(b.longitude) : fallback?.lng;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng, city: city || "destination" };
}

async function reportRunLocationDirect(input: {
  lat: number;
  lng: number;
  companyId: string;
  driverId?: string | null;
  accuracyM?: number | null;
}): Promise<TrackingNotify[]> {
  if (input.accuracyM != null && input.accuracyM > 150) return [];
  const supabase = await client();
  const here = { lat: input.lat, lng: input.lng };

  let assigned = new Set<string>();
  if (input.driverId) {
    const { data: links } = await supabase
      .from("driver_assignments")
      .select("parcel_id")
      .eq("driver_id", input.driverId)
      .eq("soft_delete", false);
    assigned = new Set((links ?? []).map((r) => String(r.parcel_id)));
  }

  const { data: parcels, error } = await supabase
    .from("parcels")
    .select(
      "id, tracking_number, status, receiver_phone, sender_phone, origin_branch_id, destination_branch_id, origin:branches!parcels_origin_branch_id_fkey(name, city, latitude, longitude), destination:branches!parcels_destination_branch_id_fkey(name, city, latitude, longitude)",
    )
    .eq("company_id", input.companyId)
    .eq("soft_delete", false)
    .in("status", ["dispatched", "in_transit", "at_destination_branch"]);

  if (error || !parcels?.length) return [];

  const rows: TrackingNotify[] = [];
  for (const raw of parcels) {
    const id = String(raw.id);
    if (input.driverId && assigned.size && !assigned.has(id)) continue;
    const origin = pointForBranch((raw.origin as BranchGeo | BranchGeo[] | null) instanceof Array ? (raw.origin as BranchGeo[])[0] : (raw.origin as BranchGeo | null));
    const dest = pointForBranch((raw.destination as BranchGeo | BranchGeo[] | null) instanceof Array ? (raw.destination as BranchGeo[])[0] : (raw.destination as BranchGeo | null));
    const destCity = dest ? coordsForCity(dest.city) : null;
    const status = String(raw.status);
    const dOrigin = origin ? distanceM(here, origin) : null;
    const dOffice = dest ? distanceM(here, dest) : null;
    const dCity = destCity ? distanceM(here, destCity) : null;

    let next: { status: string; title: string; note: string; notify: string; cityOnly?: boolean } | null = null;
    if (dOffice != null && dOffice <= 100 && ["dispatched", "in_transit", "at_destination_branch"].includes(status)) {
      next = {
        status: "ready_for_collection",
        title: "Ready for Collection",
        note: `Parcel is at the ${dest?.city || "destination"} courier office. Receiver can collect with ID.`,
        notify: "ready",
      };
    } else if (dOffice != null && dOffice <= 280 && ["dispatched", "in_transit"].includes(status)) {
      next = {
        status: "at_destination_branch",
        title: "Arrived",
        note: `Vehicle reached the ${dest?.city || "destination"} courier office.`,
        notify: "arrived",
      };
    } else if (
      dCity != null &&
      dCity <= 12000 &&
      ["dispatched", "in_transit"].includes(status) &&
      dest &&
      origin &&
      dest.city.toLowerCase() !== origin.city.toLowerCase()
    ) {
      const { data: already } = await supabase
        .from("parcel_tracking")
        .select("id")
        .eq("parcel_id", id)
        .eq("location_label", "city_enter")
        .maybeSingle();
      if (!already) {
        next = {
          status: "in_transit",
          title: `Arrived in ${dest.city}`,
          note: `Vehicle has entered ${dest.city}. Heading to the courier office.`,
          notify: "city",
          cityOnly: true,
        };
      }
    } else if (dOrigin != null && dOrigin >= 220 && status === "dispatched") {
      next = {
        status: "in_transit",
        title: "In Transit",
        note: "Vehicle has left the origin branch. Parcel is on the way.",
        notify: "transit",
      };
    }

    if (!next) continue;

    if (next.cityOnly) {
      await supabase.from("parcels").update({ status: "in_transit", updated_at: new Date().toISOString() }).eq("id", id);
      await supabase.from("parcel_tracking").insert({
        company_id: input.companyId,
        parcel_id: id,
        status: "in_transit",
        title: next.title,
        description: next.note,
        location_label: "city_enter",
        latitude: input.lat,
        longitude: input.lng,
        occurred_at: new Date().toISOString(),
        is_public: true,
      });
    } else {
      await writeParcelStatusDirect({
        parcelId: id,
        companyId: input.companyId,
        status: next.status,
        note: next.note,
      });
    }

    rows.push({
      parcel_id: id,
      tracking: String(raw.tracking_number),
      from_status: status,
      to_status: next.status,
      title: next.title,
      description: next.note,
      receiver_phone: (raw.receiver_phone as string | null) ?? null,
      sender_phone: (raw.sender_phone as string | null) ?? null,
      notify_event: next.notify,
      dest_city: dest?.city ?? null,
    });
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
