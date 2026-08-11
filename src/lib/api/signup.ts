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

type EdgeSignupResult =
  | { ok: true; welcomeEmailSent: boolean }
  | { ok: false; error?: string; unreachable?: boolean };

async function tryEdgeSignup(input: {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  phone: string;
}): Promise<EdgeSignupResult> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon) return { ok: false, unreachable: true };

  try {
    const edgeRes = await fetch(`${base}/functions/v1/signup-courier`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        full_name: input.fullName,
        company_name: input.companyName,
        phone: input.phone,
      }),
    });

    const edgeJson = (await edgeRes.json().catch(() => ({}))) as {
      error?: string;
      welcome_email_sent?: boolean;
    };

    if (edgeRes.ok) {
      return { ok: true, welcomeEmailSent: Boolean(edgeJson.welcome_email_sent) };
    }

    // 404 / failed deploy → treat as unreachable so we fall back cleanly
    if (edgeRes.status === 404 || edgeRes.status >= 500) {
      return { ok: false, unreachable: true, error: edgeJson.error };
    }

    return { ok: false, error: edgeJson.error || `Signup service error (${edgeRes.status})` };
  } catch {
    // CORS / function not deployed / offline → fall back to Auth signUp
    return { ok: false, unreachable: true };
  }
}

/**
 * Creates Auth user, signs them in, then provisions the company.
 * Uses edge signup when deployed; otherwise native Auth (turn Confirm email OFF in Supabase).
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

  let welcomeEmailSent = false;
  let createdViaEdge = false;

  const edge = await tryEdgeSignup({
    email,
    password: input.password,
    fullName,
    companyName,
    phone,
  });

  if (edge.ok) {
    createdViaEdge = true;
    welcomeEmailSent = edge.welcomeEmailSent;
  } else if (!edge.unreachable && edge.error) {
    // Real rejection from edge (e.g. email already registered)
    const already = /already|registered|exists/i.test(edge.error);
    if (!already) throw new Error(edge.error);
    // If already exists, continue to sign-in below
  } else {
    // Edge not deployed / network fail → native Auth signup
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
      // Already registered — try sign-in instead
      if (!/already|registered|exists/i.test(error.message)) {
        throw new Error(error.message);
      }
    } else if (!data.session) {
      // User created but email confirm still ON
      throw new Error(
        "Turn off Confirm email in Supabase → Authentication → Providers → Email (or deploy signup-courier), then try again.",
      );
    }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (signInError) {
    throw new Error(
      createdViaEdge
        ? signInError.message
        : `${signInError.message}. If this is a new email, turn off Confirm email in Supabase Auth settings.`,
    );
  }

  const { companyId } = await registerCourierCompany({
    companyName,
    fullName,
    email,
    phone: phone || undefined,
  });

  return { needsEmailConfirmation: false, companyId, welcomeEmailSent };
}
