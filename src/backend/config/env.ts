/**
 * Environment configuration for ParcelOS backend.
 * Delegates to browser-safe config; throws only when explicitly required.
 */

import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

export type EnvConfig = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_URL: string;
  PLATFORM_OWNER_EMAIL: string;
};

export function getEnv(): EnvConfig {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return {
    SUPABASE_URL: env.url,
    SUPABASE_ANON_KEY: env.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_URL: env.appUrl,
    PLATFORM_OWNER_EMAIL: env.platformOwnerEmail,
  };
}

export { isSupabaseConfigured };
