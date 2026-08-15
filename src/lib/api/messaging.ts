import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchMessagingSettings } from "@/lib/api/company-admin";

export type NotifyEvent = "receive" | "dispatch" | "ready" | "transit" | "city" | "arrived";

/**
 * Fire-and-forget customer SMS/WhatsApp via Edge Function.
 * Respects company messaging toggles. Never throws to callers.
 */
export async function notifyParcelStakeholders(input: {
  companyId: string;
  parcelId?: string | null;
  event: NotifyEvent;
  phone: string | null | undefined;
  message: string;
  preferWhatsApp?: boolean;
}): Promise<void> {
  try {
    if (!isSupabaseConfigured() || !input.phone?.trim() || !input.message.trim()) return;

    const settings = await fetchMessagingSettings();
    if (!settings) return;

    if (input.event === "receive" && !settings.notifyOnReceive) return;
    if ((input.event === "dispatch" || input.event === "transit" || input.event === "city") && !settings.notifyOnDispatch) {
      return;
    }
    if ((input.event === "ready" || input.event === "arrived") && !settings.notifyOnReady && !settings.notifyOnDispatch) {
      return;
    }

    const channel =
      input.preferWhatsApp && settings.whatsappEnabled
        ? "whatsapp"
        : settings.smsEnabled
          ? "sms"
          : settings.whatsappEnabled
            ? "whatsapp"
            : null;
    if (!channel) return;

    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;

    const base = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
    if (!base) return;

    await fetch(`${base}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
        apikey: import.meta.env["VITE_SUPABASE_ANON_KEY"] as string,
      },
      body: JSON.stringify({
        company_id: input.companyId,
        parcel_id: input.parcelId ?? null,
        recipient_phone: input.phone.trim(),
        message: input.message.trim(),
        channel,
      }),
    });
  } catch (err) {
    console.warn("[notifyParcelStakeholders]", err);
  }
}
