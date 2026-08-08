import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/backend/database/types";
import { getEnv } from "@/backend/config/env";

let browserClient: SupabaseClient<Database> | null = null;
let serviceClient: SupabaseClient<Database> | null = null;

/** Client-side / user-context Supabase client (respects RLS via JWT). */
export function getSupabaseClient(accessToken?: string): SupabaseClient<Database> {
  const env = getEnv();
  if (!browserClient) {
    browserClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  if (accessToken) {
    void browserClient.auth.setSession({ access_token: accessToken, refresh_token: "" });
  }
  return browserClient;
}

/** Server-side service role client — NEVER expose to browser. Bypasses RLS. */
export function getServiceClient(): SupabaseClient<Database> {
  const env = getEnv();
  if (!serviceClient) {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service client");
    }
    serviceClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export type { SupabaseClient };
