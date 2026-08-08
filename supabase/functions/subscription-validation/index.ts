import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Scheduled job: expire trials and suspend expired companies.
 * Invoke via Supabase cron or platform admin.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  let expiredCount = 0;
  let suspendedCount = 0;

  const { data: expiredSubs } = await supabase
    .from("subscriptions")
    .select("id, company_id")
    .eq("status", "trialing")
    .lt("trial_ends_at", now)
    .eq("soft_delete", false);

  for (const sub of expiredSubs ?? []) {
    await supabase.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
    await supabase.from("companies").update({ status: "expired" }).eq("id", sub.company_id);
    expiredCount++;

    await supabase.from("audit_logs").insert({
      company_id: sub.company_id,
      action: "update",
      entity_type: "subscription",
      entity_id: sub.id,
      description: "Trial expired automatically",
    });
  }

  const { data: pastDue } = await supabase
    .from("subscriptions")
    .select("company_id")
    .eq("status", "past_due")
    .eq("soft_delete", false);

  for (const sub of pastDue ?? []) {
    await supabase
      .from("companies")
      .update({ status: "suspended", suspended_at: now })
      .eq("id", sub.company_id)
      .eq("status", "past_due");
    suspendedCount++;
  }

  await supabase.from("system_logs").insert({
    level: "info",
    source: "subscription-validation",
    message: `Processed ${expiredCount} expired trials, ${suspendedCount} suspensions`,
    metadata: { expiredCount, suspendedCount },
  });

  return new Response(JSON.stringify({ expiredCount, suspendedCount }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
