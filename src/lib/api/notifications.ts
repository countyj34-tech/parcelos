import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  readAt: string | null;
  createdAt: string;
  kind: "info" | "success" | "warning" | "destructive";
};

const NOTIFICATIONS_CHANGED = "parcelos:notifications-changed";

export function emitNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  }
}

export function onNotificationsChanged(handler: () => void) {
  window.addEventListener(NOTIFICATIONS_CHANGED, handler);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED, handler);
}

function kindFromMeta(metadata: unknown, title: string): AppNotification["kind"] {
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const raw = String(meta.kind ?? meta.level ?? meta.severity ?? "").toLowerCase();
  if (raw === "success" || raw === "ok") return "success";
  if (raw === "warning" || raw === "warn") return "warning";
  if (raw === "destructive" || raw === "error" || raw === "danger") return "destructive";
  if (/fail|error|overdue|suspend/i.test(title)) return "destructive";
  if (/paid|success|deliver|unlock/i.test(title)) return "success";
  if (/trial|expir|due/i.test(title)) return "warning";
  return "info";
}

function mapRow(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    title: String(row.title ?? "Notification"),
    body: String(row.body ?? ""),
    channel: String(row.channel ?? "in_app"),
    status: String(row.status ?? "pending"),
    readAt: (row.read_at as string | null) ?? null,
    createdAt: String(row.created_at),
    kind: kindFromMeta(row.metadata, String(row.title ?? "")),
  };
}

export async function fetchMyNotifications(limit = 40): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, channel, status, read_at, created_at, metadata")
    .eq("soft_delete", false)
    .eq("channel", "in_app")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.warn("[fetchMyNotifications]", error.message);
    return [];
  }

  return data.map((r) => mapRow(r as Record<string, unknown>));
}

export async function countUnreadNotifications(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("soft_delete", false)
    .eq("channel", "in_app")
    .eq("user_id", uid)
    .is("read_at", null);

  if (error) {
    console.warn("[countUnreadNotifications]", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString(), status: "delivered" })
    .eq("id", id)
    .is("read_at", null);
  emitNotificationsChanged();
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString(), status: "delivered" })
    .eq("user_id", uid)
    .eq("channel", "in_app")
    .is("read_at", null);
  emitNotificationsChanged();
}

export function formatNotificationWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
