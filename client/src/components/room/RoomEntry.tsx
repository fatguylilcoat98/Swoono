import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import GlassPanel from "../ui/GlassPanel";
import { useRoomStore } from "../../state/roomStore";

type RoomEntryProps = {
  onJoined: () => void;
  onBack: () => void;
};

function makeRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += letters[Math.floor(Math.random() * letters.length)];
  }
  return out;
}

export default function RoomEntry({ onJoined, onBack }: RoomEntryProps) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("swoono:displayName") || "";
    } catch {
      return "";
    }
  });
  const [code, setCode] = useState("");
  const joining = useRoomStore((s) => s.joining);
  const joinError = useRoomStore((s) => s.joinError);
  const join = useRoomStore((s) => s.join);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const finalCode = code.trim() || makeRoomCode();
    try {
      localStorage.setItem("swoono:displayName", name);
    } catch {
      // storage unavailable — ignore
    }
    const ok = await join(finalCode, name);
    if (ok) onJoined();
  }

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
          <h1 className="font-display text-2xl text-swoono-ink">Join a room</h1>
          <button
            onClick={onBack}
            className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-ink transition-colors"
          >
            Back
          </button>
        </div>

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

          <div>
            <label className="block text-xs uppercase tracking-widest text-swoono-dim mb-2">
              Room code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().slice(0, 8))
                }
                placeholder="Leave blank to create"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-mono uppercase tracking-widest text-swoono-ink placeholder:text-swoono-dim/60 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-swoono-accent/60 focus:bg-white/10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setCode(makeRoomCode())}
                className="px-4 py-3 rounded-xl border border-white/10 text-swoono-dim hover:text-swoono-ink hover:border-swoono-accent/40 transition-colors text-xs uppercase tracking-widest"
              >
                New
              </button>
            </div>
          </div>

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
            disabled={joining || !name.trim()}
            className="w-full py-4 rounded-full bg-swoono-accent/20 border border-swoono-accent/50 text-swoono-ink font-medium tracking-widest uppercase text-sm hover:bg-swoono-accent/30 transition-colors shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joining ? "Joining…" : "Enter room"}
          </button>
        </form>

        <p className="mt-6 text-xs text-swoono-dim text-center leading-relaxed">
          Share your room code with the other person. Up to two people per room.
        </p>
      </GlassPanel>
    </motion.div>
  );
}
