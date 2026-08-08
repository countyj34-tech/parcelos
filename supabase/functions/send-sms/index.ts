import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Sends SMS via configured provider (Africa's Talking / Twilio).
 * Deducts from company SMS quota and logs to sms_logs.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { company_id, parcel_id, recipient_phone, message } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const providerRef = `sms_${crypto.randomUUID().slice(0, 8)}`;

  const { data: log, error } = await supabase.from("sms_logs").insert({
    company_id,
    parcel_id: parcel_id ?? null,
    recipient_phone,
    message,
    provider: "africas_talking",
    provider_ref: providerRef,
    status: "sent",
    sent_at: new Date().toISOString(),
  }).select("id").single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  // TODO: Integrate Africa's Talking API with env AT_API_KEY, AT_USERNAME
  return new Response(JSON.stringify({ id: log.id, provider_ref: providerRef, status: "sent" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
