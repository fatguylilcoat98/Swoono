import { useEffect, useState } from "react";
import {
  getSupabase,
  isAuthConfigured,
  getCachedUserEmail,
} from "../../lib/supabase";

// Required email+password auth panel. Renders on the room-entry
// screen - authentication is required to use Swoono. When Supabase is not
// configured (no VITE_SUPABASE_URL env var on Render), the whole
// component renders null and the app won't work. When configured, users can:
//
//   - Sign up with email + password (Supabase sends a confirmation
//     email if email confirmation is enabled in the project)
//   - Sign in
//   - See their signed-in email + sign out
//
// After sign-in or sign-out we reload the page so that readClientId()
// re-runs and picks up the new `user_*` clientId. This ensures their
// rooms, points, and game history persist across devices forever.

type AuthTab = "signin" | "signup";

export default function AuthPanel() {
  const configured = isAuthConfigured();
  const [tab, setTab] = useState<AuthTab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [currentEmail, setCurrentEmail] = useState<string | null>(
    () => getCachedUserEmail(),
  );

  // Re-read cached session on mount in case it was refreshed
  useEffect(() => {
    setCurrentEmail(getCachedUserEmail());
  }, []);

  if (!configured) return null;

  const signedIn = !!currentEmail;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const supa = getSupabase();
    if (!supa) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const { error } = await supa.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      setMsg("Signed in. Reloading…");
      // Reload so readClientId() picks up the new user_id as CLIENT_ID
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supa = getSupabase();
    if (!supa) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const { data, error } = await supa.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      if (data?.session) {
        // Auto-signed in (confirmation disabled in Supabase project)
        setMsg("Account created. Reloading…");
        window.setTimeout(() => window.location.reload(), 300);
      } else {
        // Confirmation email sent
        setMsg(
          "Account created. Check your email to confirm, then come " +
            "back and sign in.",
        );
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    const supa = getSupabase();
    if (!supa) return;
    setBusy(true);
    try {
      await supa.auth.signOut();
    } finally {
      window.location.reload();
    }
  };

  if (signedIn) {
    return (
      <div className="mb-5 flex items-center justify-between bg-white/5 border border-swoono-accent/20 rounded-xl px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-swoono-dim">
            Signed in as
          </p>
          <p className="text-sm text-swoono-ink truncate">{currentEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={busy}
          className="ml-3 text-[10px] uppercase tracking-widest text-swoono-dim hover:text-swoono-accent transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="mb-5 border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-xs uppercase tracking-widest text-swoono-dim">
          Required — Create Account
        </p>
        <p className="text-[11px] text-swoono-dim/70 mt-0.5">
          Your rooms, points, and games are saved forever
        </p>
      </div>

      <div className="p-4">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={`flex-1 text-[11px] uppercase tracking-widest py-2 rounded border ${
              tab === "signin"
                ? "border-swoono-accent bg-swoono-accent/10 text-swoono-accent"
                : "border-white/10 text-swoono-dim hover:border-white/30"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={`flex-1 text-[11px] uppercase tracking-widest py-2 rounded border ${
              tab === "signup"
                ? "border-swoono-accent bg-swoono-accent/10 text-swoono-accent"
                : "border-white/10 text-swoono-dim hover:border-white/30"
            }`}
          >
            Sign up
          </button>
        </div>

        <form
          onSubmit={tab === "signin" ? handleSignIn : handleSignUp}
          className="space-y-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-swoono-ink placeholder:text-swoono-dim/60 focus:outline-none focus:border-swoono-accent/60"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password (6+ characters)"
            required
            minLength={6}
            autoComplete={
              tab === "signin" ? "current-password" : "new-password"
            }
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-swoono-ink placeholder:text-swoono-dim/60 focus:outline-none focus:border-swoono-accent/60"
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          {msg && <p className="text-xs text-swoono-accent">{msg}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 rounded bg-swoono-accent/20 border border-swoono-accent/50 text-swoono-ink text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {busy
              ? "…"
              : tab === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="text-[10px] text-swoono-dim/60 mt-3 leading-snug">
          Create a free account to save your room, points, and game history forever.
          Your progress follows you across all your devices.
        </p>
      </div>
    </div>
  );
}
