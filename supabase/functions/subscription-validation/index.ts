import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Scheduled job: expire trials and suspend past-due companies.
 * Wire in Supabase Dashboard → Edge Functions → Cron (hourly recommended).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = Deno.env.get("CRON_SECRET");
  if (secret) {
    const header = req.headers.get("x-cron-secret") ?? req.headers.get("Authorization")?.replace("Bearer ", "");
    if (header !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: expiredCount, error: expireErr } = await supabase.rpc("expire_due_trials");
  if (expireErr) {
    console.error(expireErr);
  }

  const now = new Date().toISOString();
  let suspendedCount = 0;

  const { data: pastDue } = await supabase
    .from("subscriptions")
    .select("company_id")
    .eq("status", "past_due")
    .eq("soft_delete", false);

  for (const sub of pastDue ?? []) {
    const { error } = await supabase
      .from("companies")
      .update({ status: "suspended", suspended_at: now })
      .eq("id", sub.company_id)
      .in("status", ["active", "trial", "past_due"]);
    if (!error) suspendedCount++;
  }

  await supabase.from("system_logs").insert({
    level: "info",
    source: "subscription-validation",
    message: `expire_due_trials=${expiredCount ?? 0}, suspensions=${suspendedCount}`,
    metadata: { expiredCount: expiredCount ?? 0, suspendedCount },
  });

  return new Response(
    JSON.stringify({ expiredCount: expiredCount ?? 0, suspendedCount }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
