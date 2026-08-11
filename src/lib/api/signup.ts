import { getSupabase } from "@/lib/supabase/client";

export type RegisterCompanyInput = {
  companyName: string;
  fullName: string;
  email: string;
  phone?: string;
};

/** Provisions company + company_admin staff for the signed-in user (SECURITY DEFINER RPC). */
export async function registerCourierCompany(input: RegisterCompanyInput): Promise<{ companyId: string }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.rpc("register_courier_company", {
    p_company_name: input.companyName.trim(),
    p_phone: input.phone?.trim() || null,
    p_full_name: input.fullName.trim() || null,
    p_email: input.email.trim() || null,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not create company");

  return { companyId: data as string };
}

export type SignUpCompanyInput = RegisterCompanyInput & {
  password: string;
};

/**
 * Creates Auth user (already confirmed — no email click), signs them in, then provisions the company.
 * Optional congrats email is sent by the signup-courier edge function when Resend is configured.
 */
export async function signUpCourierCompany(input: SignUpCompanyInput): Promise<{
  needsEmailConfirmation: boolean;
  companyId?: string;
  welcomeEmailSent?: boolean;
}> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const companyName = input.companyName.trim();
  const phone = input.phone?.trim() ?? "";

  if (!email || !input.password || !fullName || !companyName) {
    throw new Error("All required fields must be filled");
  }
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon) throw new Error("Missing Supabase URL");

  // Prefer edge signup: creates a confirmed Auth user (no confirm-email wait)
  let welcomeEmailSent = false;
  const edgeRes = await fetch(`${base}/functions/v1/signup-courier`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({
      email,
      password: input.password,
      full_name: fullName,
      company_name: companyName,
      phone,
    }),
  });

  const edgeJson = (await edgeRes.json().catch(() => ({}))) as {
    error?: string;
    welcome_email_sent?: boolean;
  };

  if (edgeRes.ok) {
    welcomeEmailSent = Boolean(edgeJson.welcome_email_sent);
  } else {
    // Fallback: native signUp (works if Confirm email is off in Supabase Auth settings)
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
          phone,
          pending_company: true,
        },
      },
    });
    if (error) {
      throw new Error(edgeJson.error || error.message);
    }
    if (!data.session) {
      // Confirm-email still enabled and edge function not deployed
      throw new Error(
        "Account needs email confirmation. Deploy the signup-courier function or turn off Confirm email in Supabase → Authentication → Providers → Email.",
      );
    }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (signInError) throw new Error(signInError.message);

  const { companyId } = await registerCourierCompany({
    companyName,
    fullName,
    email,
    phone: phone || undefined,
  });

  return { needsEmailConfirmation: false, companyId, welcomeEmailSent };
}
