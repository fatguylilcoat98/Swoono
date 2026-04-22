import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import GlassPanel from "../ui/GlassPanel";
import { useRoomStore } from "../../state/roomStore";
import AuthPanel from "../auth/AuthPanel";

type RoomEntryProps = {
  onJoined: () => void;
  onBack: () => void;
};

type Mode = "choose" | "create" | "join";

function makeRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += letters[Math.floor(Math.random() * letters.length)];
  }
  return out;
}

export default function RoomEntry({ onJoined, onBack }: RoomEntryProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("swoono:displayName") || "";
    } catch {
      return "";
    }
  });
  const [code, setCode] = useState("");
  const [generatedCode] = useState(() => makeRoomCode());
  const [partnerEmail, setPartnerEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const joining = useRoomStore((s) => s.joining);
  const joinError = useRoomStore((s) => s.joinError);
  const join = useRoomStore((s) => s.join);

  function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerEmail.trim()) return;

    const inviteMessage = `Join me on Swoono! 💕\n\nDownload the app and enter room code: ${generatedCode}\nhttps://swoono.onrender.com\n\n- ${name || 'Your partner'}`;

    // Copy to clipboard as fallback (email sending would require backend)
    try {
      navigator.clipboard.writeText(inviteMessage);
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      alert(`Send this invite to ${partnerEmail}:\n\n${inviteMessage}`);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const targetCode =
      mode === "create" ? generatedCode : code.trim().toUpperCase();
    if (!targetCode) return;
    try {
      localStorage.setItem("swoono:displayName", name);
    } catch {
      // storage unavailable — ignore
    }
    const ok = await join(targetCode, name);
    if (ok) onJoined();
  }

  const headerTitle =
    mode === "create"
      ? "Create a room"
      : mode === "join"
        ? "Join a room"
        : "Start";

  return (
    <motion.div
      className="relative min-h-dvh flex items-center justify-center p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <GlassPanel
        variant="strong"
        glow
        className="w-full max-w-md p-8 md:p-10"
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-swoono-ink">
            {headerTitle}
          </h1>
          <button
            onClick={mode === "choose" ? onBack : () => setMode("choose")}
            className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-ink transition-colors"
          >
            Back
          </button>
        </div>

        <AuthPanel />

        {mode === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-swoono-dim text-center leading-relaxed mb-5">
              A room is a private space for you and one other person.
              Pick one:
            </p>
            <button
              onClick={() => setMode("create")}
              className="w-full py-5 rounded-xl bg-swoono-accent/20 border border-swoono-accent/50 text-swoono-ink text-left px-5 hover:bg-swoono-accent/30 transition-colors shadow-glow"
            >
              <div className="font-medium uppercase tracking-widest text-sm mb-1">
                Create a room
              </div>
              <div className="text-[11px] text-swoono-dim">
                Generates a code. Share it with your person.
              </div>
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full py-5 rounded-xl bg-white/5 border border-white/15 text-swoono-ink text-left px-5 hover:bg-white/10 transition-colors"
            >
              <div className="font-medium uppercase tracking-widest text-sm mb-1">
                Join a room
              </div>
              <div className="text-[11px] text-swoono-dim">
                Enter the code they sent you.
              </div>
            </button>
          </div>
        )}

        {(mode === "create" || mode === "join") && (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-swoono-dim mb-2">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={32}
                required
                autoComplete="nickname"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-swoono-ink placeholder:text-swoono-dim/60 focus:outline-none focus:border-swoono-accent/60 focus:bg-white/10 transition-colors"
              />
            </div>

            {mode === "create" ? (
              <div>
                <label className="block text-xs uppercase tracking-widest text-swoono-dim mb-2">
                  Your room code
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 border border-swoono-accent/30 rounded-xl px-4 py-3 font-mono uppercase tracking-[0.3em] text-swoono-accent text-center text-lg">
                    {generatedCode}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(generatedCode);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="px-4 py-3 rounded-xl border border-white/10 text-swoono-dim hover:text-swoono-ink hover:border-swoono-accent/40 transition-colors text-[10px] uppercase tracking-widest"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-swoono-dim mt-2 leading-snug">
                  Share this code with your person. They'll tap{" "}
                  <span className="text-swoono-ink">Join a room</span> on
                  their phone and enter this code.
                </p>

                {/* Partner Email Invite */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs uppercase tracking-widest text-swoono-dim mb-3">
                    Or invite by email
                  </p>
                  <form onSubmit={handleSendInvite} className="space-y-3">
                    <input
                      type="email"
                      value={partnerEmail}
                      onChange={(e) => setPartnerEmail(e.target.value)}
                      placeholder="partner@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-swoono-ink placeholder:text-swoono-dim/60 focus:outline-none focus:border-swoono-accent/60 focus:bg-white/10 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!partnerEmail.trim() || inviteSent}
                      className="w-full py-2 rounded-xl bg-white/10 border border-white/10 text-swoono-ink text-xs uppercase tracking-widest hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {inviteSent ? "Invite Copied to Clipboard!" : "Copy Invite Message"}
                    </button>
                  </form>
                  <p className="text-[10px] text-swoono-dim/60 mt-2 leading-snug">
                    Creates a message with the room code you can send via your favorite app.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs uppercase tracking-widest text-swoono-dim mb-2">
                  Their room code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().slice(0, 8))
                  }
                  placeholder="ENTER CODE"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-mono uppercase tracking-[0.3em] text-swoono-ink placeholder:text-swoono-dim/60 text-center text-lg focus:outline-none focus:border-swoono-accent/60 focus:bg-white/10 transition-colors"
                />
              </div>
            )}

            {joinError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-swoono-accent"
              >
                {joinError}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={
                joining ||
                !name.trim() ||
                (mode === "join" && !code.trim())
              }
              className="w-full py-4 rounded-full bg-swoono-accent/20 border border-swoono-accent/50 text-swoono-ink font-medium tracking-widest uppercase text-sm hover:bg-swoono-accent/30 transition-colors shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining
                ? "Joining…"
                : mode === "create"
                  ? "Open the room"
                  : "Join the room"}
            </button>
          </form>
        )}

        <p className="mt-6 text-xs text-swoono-dim text-center leading-relaxed">
          Up to two people per room. Anyone else with the code gets
          rejected.
        </p>
      </GlassPanel>
    </motion.div>
  );
}
