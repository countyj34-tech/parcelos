import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe is not configured on the server" }), {
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

    const body = await req.json();
    const planCode = String(body.plan_code ?? "starter");
    const successUrl = String(body.success_url);
    const cancelUrl = String(body.cancel_url);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await admin
      .from("users")
      .select("company_id, email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company on account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plan } = await admin
      .from("subscription_plans")
      .select("id, code, name, price_cents, currency_code")
      .eq("code", planCode)
      .maybeSingle();

    if (!plan) {
      return new Response(JSON.stringify({ error: "Unknown plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const { data: company } = await admin
      .from("companies")
      .select("id, name, stripe_customer_id, email")
      .eq("id", profile.company_id)
      .single();

    let customerId = company?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (profile.email as string) || (company?.email as string) || user.email || undefined,
        name: (company?.name as string) || undefined,
        metadata: { company_id: company!.id as string },
      });
      customerId = customer.id;
      await admin.from("companies").update({ stripe_customer_id: customerId }).eq("id", company!.id);
    }

    // Prefer env price IDs; otherwise create a one-off price from plan cents
    const envPrice =
      Deno.env.get(`STRIPE_PRICE_${String(plan.code).toUpperCase()}`) ||
      Deno.env.get("STRIPE_PRICE_STARTER");

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    if (envPrice) {
      lineItems = [{ price: envPrice, quantity: 1 }];
    } else {
      lineItems = [
        {
          price_data: {
            currency: String(plan.currency_code || "usd").toLowerCase(),
            unit_amount: Number(plan.price_cents) || 9900,
            recurring: { interval: "month" },
            product_data: { name: `ParcelOS ${plan.name}` },
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: company!.id as string,
      metadata: {
        company_id: company!.id as string,
        plan_code: plan.code as string,
        plan_id: plan.id as string,
      },
      subscription_data: {
        metadata: {
          company_id: company!.id as string,
          plan_code: plan.code as string,
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
