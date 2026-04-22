/**
 * Client-side Supabase singleton.
 *
 * Auth-only for now. The server side already uses the service_role key
 * for data access; the client never talks to Supabase data tables
 * directly — it uses the Socket.IO server as the gatekeeper. The only
 * thing the client DOES use Supabase for is auth: email/password sign
 * in + sign up, session persistence in localStorage, and pulling a
 * stable user_id that can be used as the room-ownership key.
 *
 * ENVIRONMENT
 * -----------
 * Needs two Vite env vars in the client's environment (both safe to
 * ship publicly — the anon key is designed to be exposed):
 *
 *   VITE_SUPABASE_URL       — e.g. https://xxxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY  — the `anon public` key from the API
 *                             settings page
 *
 * If either env var is missing, `getSupabase()` returns null and
 * `isAuthConfigured()` returns false. The app still works in
 * anonymous (localStorage-clientId) mode — auth is purely additive.
 *
 * SECURITY NOTE
 * -------------
 * The client passes its Supabase user_id to our Socket.IO server as
 * the `clientId` field. For tonight's MVP the server TRUSTS that
 * value the same way it already trusts the anonymous localStorage
 * clientId — no JWT verification. A malicious client could forge a
 * user_id and take over someone else's room. This is no worse than
 * today's anonymous setup, but it's worth closing in a follow-up
 * pass by having the server verify the JWT via `auth.getUser()`
 * with the service_role key.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storageKey: 'swoono-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

export function isAuthConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Synchronous read of the cached session. Supabase stores the session
 * in localStorage under our custom `swoono:auth` key, so we can pull
 * the user_id at app startup without waiting on an async call. Used
 * by readClientId() to decide between user_id and anonymous mode.
 */
export function getCachedUserId(): string | null {
  if (!isAuthConfigured()) return null;
  try {
    const raw = localStorage.getItem("swoono-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const userId =
      parsed?.currentSession?.user?.id ||
      parsed?.user?.id ||
      parsed?.data?.session?.user?.id ||
      null;
    return typeof userId === "string" ? userId : null;
  } catch {
    return null;
  }
}

export function getCachedUserEmail(): string | null {
  if (!isAuthConfigured()) return null;
  try {
    const raw = localStorage.getItem("swoono-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const email =
      parsed?.currentSession?.user?.email ||
      parsed?.user?.email ||
      parsed?.data?.session?.user?.email ||
      null;
    return typeof email === "string" ? email : null;
  } catch {
    return null;
  }
}
