import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Creates a GenesysPay hosted-checkout payload for Zambia (ZMW).
 * Supports multi-month + SMS/WA addons via quote_saas_checkout.
 * Client posts the returned fields to https://checkout.genesyspay.com/v1/hosted/initiate
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const pubKey = Deno.env.get("GENESYSPAY_PUBLIC_KEY");
    const privateKey = Deno.env.get("GENESYSPAY_PRIVATE_KEY");
    if (!pubKey) {
      return new Response(JSON.stringify({ error: "GenesysPay is not configured (GENESYSPAY_PUBLIC_KEY)" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const planCode = String(body.plan_code ?? "starter");
    const months = Math.max(1, Math.min(24, Number(body.months ?? 1) || 1));
    const addonCodes = Array.isArray(body.addon_codes)
      ? body.addon_codes.map(String)
      : typeof body.addon_codes === "string"
        ? [body.addon_codes]
        : [];
    const method = body.method ? String(body.method) : undefined; // airtel | mtn | zamtel
    const phone = body.phone_number ? String(body.phone_number) : undefined;
    const mode = String(body.mode ?? "hosted"); // hosted | direct

    const appUrl = Deno.env.get("APP_URL") ?? Deno.env.get("VITE_APP_URL") ?? "http://localhost:3000";
    const callbackUrl =
      Deno.env.get("GENESYSPAY_CALLBACK_URL") ??
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/genesyspay-webhook`;

    const { data: intentRows, error: intentErr } = await supabase.rpc("create_saas_payment_intent", {
      p_plan_code: planCode,
      p_months: months,
      p_addon_codes: addonCodes,
    });
    if (intentErr) {
      return new Response(JSON.stringify({ error: intentErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intent = Array.isArray(intentRows) ? intentRows[0] : intentRows;
    if (!intent?.tx_ref) {
      return new Response(JSON.stringify({ error: "Could not create payment intent" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const descParts = [`ParcelOS ${intent.plan_name}`, `${intent.months ?? months} mo`];
    if (Number(intent.sms_credits) > 0) descParts.push(`${intent.sms_credits} SMS`);
    if (Number(intent.whatsapp_months) > 0) descParts.push(`WA ${intent.whatsapp_months}m`);
    const description = `${descParts.join(" · ")} — ${intent.company_name}`;

    // Direct MoMo charge (customer approves on phone)
    if (mode === "direct" && privateKey && phone && method) {
      const payinRes = await fetch("https://genesyspay.com/api/v2/payins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${privateKey}`,
        },
        body: JSON.stringify({
          amount: Number(intent.amount_major),
          currency: intent.currency_code || "ZMW",
          country: "ZM",
          channel: "mobile_money",
          method,
          phone_number: phone.replace(/\s+/g, ""),
          tx_ref: intent.tx_ref,
          callback_url: callbackUrl,
          extras: {
            company_id: intent.company_id,
            plan_code: intent.plan_code,
            intent_id: intent.intent_id,
            months: intent.months,
          },
        }),
      });
      const payinJson = await payinRes.json();
      if (!payinRes.ok || payinJson.status === "error") {
        return new Response(
          JSON.stringify({ error: payinJson.message ?? "GenesysPay payin failed", details: payinJson }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await admin
        .from("saas_payment_intents")
        .update({
          status: "submitted",
          channel: "mobile_money",
          method,
          phone_number: phone,
          genesys_transaction_id: payinJson.data?.transaction_id ?? null,
          provider_payload: payinJson,
          updated_at: new Date().toISOString(),
        })
        .eq("tx_ref", intent.tx_ref);

      return new Response(
        JSON.stringify({
          mode: "direct",
          tx_ref: intent.tx_ref,
          transaction_id: payinJson.data?.transaction_id,
          message: "Check your phone and approve the Mobile Money prompt",
          amount: intent.amount_major,
          currency: intent.currency_code,
          months: intent.months,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Hosted checkout — pick MTN / Airtel / Zamtel on Genesys page
    return new Response(
      JSON.stringify({
        mode: "hosted",
        checkout_url: "https://checkout.genesyspay.com/v1/hosted/initiate",
        fields: {
          pub_key: pubKey,
          amount: String(intent.amount_major),
          currency: intent.currency_code || "ZMW",
          country: "ZM",
          allowed_channels: "mobile_money",
          tx_ref: intent.tx_ref,
          description,
          redirect_url: `${appUrl}/app/subscription?paid=1&tx_ref=${encodeURIComponent(intent.tx_ref)}`,
          callback_url: callbackUrl,
          payer_name: intent.payer_name ?? "",
          payer_email: intent.payer_email ?? "",
          payer_phone: intent.payer_phone ?? "",
          ...(method ? { method } : {}),
        },
        tx_ref: intent.tx_ref,
        amount: intent.amount_major,
        currency: intent.currency_code,
        plan_name: intent.plan_name,
        months: intent.months,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
