import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Single Supabase client for the app. The URL and anon key are baked into
// the client bundle by Vite at build time — they're safe to ship (gated by
// RLS), see BACKEND.md.
//
// The client is lazy-instantiated. Module-level `createClient(...)` brought
// the realtime websocket factory in at import time, which trips Node-only
// test runners (vitest) that don't ship a global WebSocket. Tests that
// don't touch the backend never call getSupabase(), so realtime never loads.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let cached: SupabaseClient | null | undefined;

/** Returns the shared Supabase client, or null if env vars are unset.
 *  Each db/* module guards on `hasBackend()` and then calls this. */
export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  if (!url || !anonKey) {
    cached = null;
    return cached;
  }
  cached = createClient(url, anonKey, {
    auth: {
      // We don't use Supabase auth in v1 — anonymous device IDs only.
      // Disable the session machinery so it doesn't try to persist or
      // refresh anything.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}

/** True if env vars were present at build time. Use to guard best-effort
 *  code paths before calling getSupabase(). */
export function hasBackend(): boolean {
  return !!(url && anonKey);
}
