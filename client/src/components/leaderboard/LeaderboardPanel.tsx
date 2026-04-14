import GlassPanel from "../ui/GlassPanel";
import { useRoomStore } from "../../state/roomStore";
import { usePointsStore } from "../../state/pointsStore";

export default function LeaderboardPanel() {
  const peers = useRoomStore((s) => s.peers);
  const selfId = useRoomStore((s) => s.clientId);
  const points = usePointsStore((s) => s.points);

  // Placeholder scoring: self is authoritative, partner is 0 until the
  // server relays game results in Phase 2.
  const rows = peers.map((p) => ({
    name: p.name,
    points: p.clientId === selfId ? points : 0,
    self: p.clientId === selfId,
  }));

  return (
    <GlassPanel className="p-5">
      <h2 className="font-display text-lg text-swoono-ink mb-4">Leaderboard</h2>
      <div className="flex flex-col gap-2">
        {rows.length === 0 && (
          <p className="text-swoono-dim text-xs">Waiting for players…</p>
        )}
        {rows.map((r, i) => (
          <div
            key={i}
            className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              r.self
                ? "bg-swoono-accent/10 border border-swoono-accent/30"
                : "bg-white/[0.03]"
            }`}
          >
            <span className="text-sm text-swoono-ink">{r.name}</span>
            <span className="text-xs text-swoono-dim font-mono">{r.points}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-swoono-dim/70">
        Shared scoring syncs in Phase 2.
      </p>
    </GlassPanel>
  );
}
