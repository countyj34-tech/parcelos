import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generates a unique tracking number: POS-{sequence}-{country}
 * Called when creating parcels from reception or customer portal.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { company_id, country_code } = await req.json();
    if (!company_id || !country_code) {
      return new Response(JSON.stringify({ error: "company_id and country_code required" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supabase
      .from("company_settings")
      .select("tracking_prefix")
      .eq("company_id", company_id)
      .single();

    const prefix = settings?.tracking_prefix ?? "POS";
    const seq = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const trackingNumber = `${prefix}-${seq}-${country_code.toUpperCase()}`;

    return new Response(JSON.stringify({ tracking_number: trackingNumber }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
