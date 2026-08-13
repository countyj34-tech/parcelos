import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AuditPayload = {
  company_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, unknown>;
};

/**
 * Centralized audit logging edge function.
 * Ensures consistent audit trail from client and server contexts.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const payload: AuditPayload = await req.json();

  const { data, error } = await supabase.from("audit_logs").insert({
    company_id: payload.company_id ?? null,
    actor_id: user.id,
    action: payload.action,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id ?? null,
    description: payload.description,
    metadata: payload.metadata ?? {},
  }).select("id").single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ id: data.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
