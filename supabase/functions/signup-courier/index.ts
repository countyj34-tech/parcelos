import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWelcomeEmail(input: {
  to: string;
  fullName: string;
  companyName: string;
  appUrl: string;
}): Promise<{ sent: boolean; detail: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from =
    Deno.env.get("RESEND_FROM_EMAIL") ??
    Deno.env.get("WELCOME_FROM_EMAIL") ??
    "ParcelOS <onboarding@resend.dev>";

  if (!resendKey) {
    return { sent: false, detail: "RESEND_API_KEY not set — skipped welcome email" };
  }

  const subject = `Welcome to ParcelOS — ${input.companyName} is ready`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 8px;">Congratulations, ${input.fullName}!</h1>
      <p style="line-height: 1.5; color: #334155;">
        Your courier company <strong>${input.companyName}</strong> is live on ParcelOS.
        Sign in and finish branding, then share your customer portal link.
      </p>
      <p style="margin: 24px 0;">
        <a href="${input.appUrl}/login"
           style="background:#0f766e;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">
          Open ParcelOS
        </a>
      </p>
      <p style="font-size: 13px; color: #64748b;">You have a 14-day free trial to explore operations.</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      html,
    }),
  });

  const text = await res.text();
  return { sent: res.ok, detail: text.slice(0, 400) };
}

/**
 * Instant company signup — creates Auth user already confirmed (no email confirm click).
 * Client then signs in with the same password and provisions the company workspace.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.full_name ?? "").trim();
    const companyName = String(body.company_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();

    if (!email || !password || !fullName || !companyName) {
      return new Response(JSON.stringify({ error: "email, password, full_name, and company_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        company_name: companyName,
        phone,
        pending_company: true,
      },
    });

    if (createErr) {
      const msg = createErr.message || "Could not create user";
      const status = /already|registered|exists/i.test(msg) ? 409 : 400;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl =
      Deno.env.get("APP_URL") ??
      Deno.env.get("VITE_APP_URL") ??
      "https://parcelos.africa";

    const welcome = await sendWelcomeEmail({
      to: email,
      fullName,
      companyName,
      appUrl: appUrl.replace(/\/$/, ""),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: created.user?.id,
        email,
        welcome_email_sent: welcome.sent,
        welcome_detail: welcome.detail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
