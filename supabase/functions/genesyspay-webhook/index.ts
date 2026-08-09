import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * GenesysPay webhook — activates company subscription on payin.successful.
 * Docs: https://genesyspay.com/docs/v2/webhooks
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawBody = await req.text();
  const webhookSecret = Deno.env.get("GENESYSPAY_WEBHOOK_SECRET");

  if (webhookSecret) {
    const received = req.headers.get("x-webhook-signature") ?? "";
    const expected = await hmacSha256Hex(webhookSecret, rawBody);
    if (received !== expected) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let payload: {
    event?: string;
    data?: {
      tx_ref?: string;
      transaction_id?: string;
      status?: string;
      [key: string]: unknown;
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const event = payload.event ?? "";
  const txRef = payload.data?.tx_ref;
  const transactionId = payload.data?.transaction_id ?? null;

  if (!txRef) {
    return new Response(JSON.stringify({ ok: true, skipped: "no tx_ref" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let activated = false;

  if (event === "payin.successful" || payload.data?.status === "SUCCESS") {
    const { error } = await supabase.rpc("activate_subscription_from_genesys", {
      p_tx_ref: txRef,
      p_transaction_id: transactionId,
      p_payload: payload,
    });
    if (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    activated = true;
  } else if (
    event === "payin.failed" ||
    event === "payin.cancelled" ||
    payload.data?.status === "FAILED" ||
    payload.data?.status === "CANCELLED"
  ) {
    await supabase.rpc("mark_saas_payment_failed", {
      p_tx_ref: txRef,
      p_payload: payload,
    });
  }

  await supabase.from("system_logs").insert({
    level: "info",
    source: "genesyspay-webhook",
    message: `${event || "unknown"} · ${txRef}${activated ? " · activated" : ""}`,
    metadata: {
      event,
      txRef,
      transactionId,
      status: payload.data?.status,
      activated,
    },
  });

  return new Response(JSON.stringify({ received: true, activated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
