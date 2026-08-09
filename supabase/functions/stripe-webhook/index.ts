import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

serve(async (req) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("No signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return new Response(message, { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const activateCompany = async (companyId: string, sub: Stripe.Subscription, planId?: string) => {
    const periodEnd = new Date((sub.current_period_end || 0) * 1000).toISOString();
    await admin
      .from("companies")
      .update({
        status: "active",
        stripe_customer_id: String(sub.customer),
        trial_ends_at: null,
      })
      .eq("id", companyId);

    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      status: "active",
      stripe_customer_id: String(sub.customer),
      stripe_subscription_id: sub.id,
      stripe_price_id: sub.items.data[0]?.price?.id ?? null,
      current_period_end: periodEnd,
      trial_ends_at: null,
      ...(planId ? { plan_id: planId } : {}),
    };

    if (existing?.id) {
      await admin.from("subscriptions").update(payload).eq("id", existing.id);
    } else {
      await admin.from("subscriptions").insert({ company_id: companyId, ...payload });
    }
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const companyId = session.metadata?.company_id || session.client_reference_id;
    const planId = session.metadata?.plan_id;
    if (companyId && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(String(session.subscription));
      await activateCompany(companyId, sub, planId);
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const companyId = sub.metadata?.company_id;
    if (companyId) {
      if (sub.status === "active" || sub.status === "trialing") {
        await activateCompany(companyId, sub);
      } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
        await admin.from("companies").update({ status: "expired" }).eq("id", companyId);
        await admin
          .from("subscriptions")
          .update({ status: "expired", stripe_subscription_id: sub.id })
          .eq("company_id", companyId);
      } else if (sub.status === "past_due") {
        await admin.from("companies").update({ status: "past_due" }).eq("id", companyId);
        await admin
          .from("subscriptions")
          .update({ status: "past_due", stripe_subscription_id: sub.id })
          .eq("company_id", companyId);
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const companyId = invoice.subscription_details?.metadata?.company_id;
    // soft signal — past_due handled on subscription update
    if (companyId) {
      await admin.from("companies").update({ status: "past_due" }).eq("id", companyId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
