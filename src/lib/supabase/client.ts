import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

/** Singleton Supabase browser client. Returns null in demo mode (no env). */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  const env = getSupabaseEnv();
  if (!env) return null;

  if (!browserClient) {
    browserClient = createClient(env.url, env.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        storageKey: "parcelos-company-auth",
      },
    });
  }

  return browserClient;
}

export type { SupabaseClient };
