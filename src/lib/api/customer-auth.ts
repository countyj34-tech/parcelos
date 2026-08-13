import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured, getAuthRedirectPath } from "@/lib/supabase/config";

export type RegisterCustomerInput = {
  companyId: string;
  companySlug: string;
  fullName: string;
  phone: string;
  email?: string | null;
  password: string;
};

function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `c${digits}@customers.parcelos.app`;
}

/** Create a real Supabase Auth customer linked to this courier company. */
export async function registerCustomerAccount(
  input: RegisterCustomerInput,
): Promise<{ error?: string; needsEmailConfirm?: boolean }> {
  if (!isSupabaseConfigured()) return { error: "App is not connected to the database" };
  const supabase = getSupabase();
  if (!supabase) return { error: "App is not connected to the database" };

  const email = (input.email?.trim() || phoneToEmail(input.phone)).toLowerCase();
  const password = input.password;
  if (password.length < 6) return { error: "Password must be at least 6 characters" };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectPath(`/c/${input.companySlug}`),
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        user_type: "customer",
        company_id: input.companyId,
      },
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Could not create account" };

  // Session may be null when email confirmation is required
  if (!data.session) {
    return { needsEmailConfirm: true };
  }

  const { error: profileError } = await supabase.rpc("ensure_my_customer_profile", {
    p_company_id: input.companyId,
    p_full_name: input.fullName.trim(),
    p_phone: input.phone.trim(),
    p_email: input.email?.trim() || email,
  });

  if (profileError) {
    console.warn("[ensure_my_customer_profile]", profileError.message);
    return {
      error:
        profileError.message.includes("ensure_my_customer_profile") ||
        profileError.message.includes("Could not find")
          ? "Account created, but profile linking needs migration 32 applied in Supabase."
          : profileError.message,
    };
  }

  return {};
}
