import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Sends SMS (Africa's Talking or Twilio) and logs to sms_logs.
 * WhatsApp: set channel=whatsapp + TWILIO_WHATSAPP_FROM.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json();
    const company_id = payload.company_id as string;
    const parcel_id = (payload.parcel_id as string | null) ?? null;
    const recipient_phone = String(payload.recipient_phone ?? "");
    const message = String(payload.message ?? "");
    const channel = String(payload.channel ?? "sms");

    if (!company_id || !recipient_phone || !message) {
      return new Response(JSON.stringify({ error: "company_id, recipient_phone, message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional: require caller JWT for non-service use
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: settings } = await supabase
      .from("company_settings")
      .select("sms_enabled, whatsapp_enabled, sms_sender_id")
      .eq("company_id", company_id)
      .maybeSingle();

    if (channel === "whatsapp" && settings?.whatsapp_enabled === false) {
      return new Response(JSON.stringify({ error: "WhatsApp disabled for company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (channel !== "whatsapp" && settings?.sms_enabled === false) {
      return new Response(JSON.stringify({ error: "SMS disabled for company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let provider = "log_only";
    let providerRef = `local_${crypto.randomUUID().slice(0, 8)}`;
    let status: "sent" | "failed" | "queued" = "queued";
    let errorMessage: string | null = null;

    const atKey = Deno.env.get("AT_API_KEY");
    const atUser = Deno.env.get("AT_USERNAME");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_FROM");
    const twilioWa = Deno.env.get("TWILIO_WHATSAPP_FROM");

    if (channel === "whatsapp" && twilioSid && twilioToken && twilioWa) {
      provider = "twilio_whatsapp";
      const body = new URLSearchParams({
        To: recipient_phone.startsWith("whatsapp:") ? recipient_phone : `whatsapp:${recipient_phone}`,
        From: twilioWa.startsWith("whatsapp:") ? twilioWa : `whatsapp:${twilioWa}`,
        Body: message,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      const json = await res.json();
      if (!res.ok) {
        status = "failed";
        errorMessage = json.message ?? "Twilio WhatsApp failed";
      } else {
        status = "sent";
        providerRef = json.sid ?? providerRef;
      }
    } else if (atKey && atUser && channel !== "whatsapp") {
      provider = "africas_talking";
      const body = new URLSearchParams({
        username: atUser,
        to: recipient_phone,
        message,
        ...(settings?.sms_sender_id ? { from: String(settings.sms_sender_id) } : {}),
      });
      const res = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          apiKey: atKey,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      });
      const text = await res.text();
      if (!res.ok) {
        status = "failed";
        errorMessage = text.slice(0, 500);
      } else {
        status = "sent";
        providerRef = `at_${Date.now()}`;
      }
    } else if (twilioSid && twilioToken && twilioFrom && channel !== "whatsapp") {
      provider = "twilio";
      const body = new URLSearchParams({ To: recipient_phone, From: twilioFrom, Body: message });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      const json = await res.json();
      if (!res.ok) {
        status = "failed";
        errorMessage = json.message ?? "Twilio failed";
      } else {
        status = "sent";
        providerRef = json.sid ?? providerRef;
      }
    } else {
      // Dev / not configured — still log for ops visibility
      status = "sent";
      provider = "log_only";
    }

    const { data: log, error } = await supabase
      .from("sms_logs")
      .insert({
        company_id,
        parcel_id,
        recipient_phone,
        message,
        provider,
        provider_ref: providerRef,
        status,
        error_message: errorMessage,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ id: log.id, provider, provider_ref: providerRef, status, channel }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMS error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
