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
 * Creates Auth user, then company workspace.
 * If email confirmation is required (no session yet), company is created on first successful sign-in
 * using user_metadata — see ensureCompanyForSession in use-auth.
 */
export async function signUpCourierCompany(input: SignUpCompanyInput): Promise<{
  needsEmailConfirmation: boolean;
  companyId?: string;
}> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const companyName = input.companyName.trim();

  if (!email || !input.password || !fullName || !companyName) {
    throw new Error("All required fields must be filled");
  }
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: fullName,
        company_name: companyName,
        phone: input.phone?.trim() ?? "",
        pending_company: true,
      },
      emailRedirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/login`,
    },
  });

  if (error) throw new Error(error.message);

  if (!data.session) {
    return { needsEmailConfirmation: true };
  }

  const { companyId } = await registerCourierCompany({
    companyName,
    fullName,
    email,
    phone: input.phone,
  });

  return { needsEmailConfirmation: false, companyId };
}
