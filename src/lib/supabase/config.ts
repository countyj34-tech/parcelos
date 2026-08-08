/**
 * Supabase configuration — safe for browser when env vars are absent (demo mode).
 */

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return false;
  const placeholders = [
    "your-supabase-url",
    "YOUR_PROJECT_REF",
    "your-project",
    "YOUR_ANON_KEY",
    "your-anon-key",
  ];
  if (placeholders.some((p) => url.includes(p) || key.includes(p))) return false;
  return url.startsWith("http");
}

export type SupabaseEnv = {
  url: string;
  anonKey: string;
  appUrl: string;
  platformOwnerEmail: string;
};

export function getSupabaseEnv(): SupabaseEnv | null {
  if (!isSupabaseConfigured()) return null;
  return {
    url: import.meta.env.VITE_SUPABASE_URL as string,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    appUrl: (import.meta.env.VITE_APP_URL as string | undefined) ?? "http://localhost:3000",
    platformOwnerEmail:
      (import.meta.env.VITE_PLATFORM_OWNER_EMAIL as string | undefined) ?? "admin@mthunzi.tech",
  };
}
