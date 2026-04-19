import GlassPanel from "../ui/GlassPanel";
import { useRoomStore } from "../../state/roomStore";
import { usePointsStore } from "../../state/pointsStore";
import { getGame } from "../../lib/registries/gameRegistry";
import type { GameRecord } from "../../lib/types";

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function recordLabel(
  r: GameRecord,
  selfId: string,
  nameByClientId: Record<string, string>,
): string {
  const def = getGame(r.gameId);
  const gameName = def?.name ?? r.gameId;
  if (r.outcome === "draw") return `${gameName} · draw`;
  if (r.outcome === "coop-win") return `${gameName} · completed together`;
  if (r.outcome === "coop-loss") return `${gameName} · tough round`;
  // outcome === "win"
  if (!r.winnerClientId) return gameName;
  const winnerIsSelf = r.winnerClientId === selfId;
  const winnerName = winnerIsSelf
    ? "You"
    : nameByClientId[r.winnerClientId] || "Partner";
  return `${gameName} · ${winnerName} won`;
}

export default function LeaderboardPanel() {
  const peers = useRoomStore((s) => s.peers);
  const selfId = useRoomStore((s) => s.clientId);
  const peerPoints = useRoomStore((s) => s.peerPoints);
  const records = useRoomStore((s) => s.records);
  const myPoints = usePointsStore((s) => s.points);

  const rows = peers.map((p) => ({
    name: p.name,
    points: p.clientId === selfId ? myPoints : (peerPoints[p.clientId] || 0),
    self: p.clientId === selfId,
  }));

  // Build a quick clientId → name map for the records list
  const nameByClientId: Record<string, string> = {};
  peers.forEach((p) => {
    nameByClientId[p.clientId] = p.name;
  });

  const recent = records.slice(0, 6);

  return (
    <GlassPanel className="p-5">
      <h2 className="font-display text-lg text-swoono-ink mb-4">Leaderboard</h2>
      <div className="flex flex-col gap-2 mb-4">
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

      <div className="mt-4 border-t border-white/5 pt-3">
        <h3 className="text-[10px] uppercase tracking-widest text-swoono-dim mb-2">
          Recent games
        </h3>
        {recent.length === 0 ? (
          <p className="text-[11px] text-swoono-dim/70">
            No games played yet. Pick one from the menu.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-swoono-ink/90 truncate pr-2">
                  {recordLabel(r, selfId, nameByClientId)}
                </span>
                <span className="text-swoono-dim/70 font-mono shrink-0">
                  {formatRelative(r.finishedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-[10px] text-swoono-dim/70">
        Points sync across sessions and players.
      </p>
    </GlassPanel>
  );
}
