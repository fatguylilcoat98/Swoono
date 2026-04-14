import GlassPanel from "../ui/GlassPanel";
import {
  getGames,
  type GameDefinition,
} from "../../lib/registries/gameRegistry";
import { useRoomStore } from "../../state/roomStore";

export default function GameMenu() {
  const games = getGames();
  const startGame = useRoomStore((s) => s.startGame);
  const activeGame = useRoomStore((s) => s.activeGame);
  const gameInProgress = activeGame !== null;

  return (
    <GlassPanel className="p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-lg text-swoono-ink">Games</h2>
        <span className="text-swoono-dim text-[10px] uppercase tracking-widest">
          {gameInProgress ? "In play" : `${games.length} queued`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {games.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            disabled={gameInProgress}
            onPlay={() => startGame(g.id)}
          />
        ))}
      </div>
      <p className="mt-3 text-[10px] text-swoono-dim/70">
        Game modules plug into{" "}
        <code className="text-swoono-dim">gameRegistry</code>.
      </p>
    </GlassPanel>
  );
}

function GameCard({
  game,
  disabled,
  onPlay,
}: {
  game: GameDefinition;
  disabled: boolean;
  onPlay: () => void;
}) {
  const locked = game.tier > 0;
  const available = game.status === "ready" && !locked && !disabled;
  return (
    <button
      type="button"
      disabled={!available}
      onClick={available ? onPlay : undefined}
      className={`text-left rounded-xl p-3 border transition-all ${
        available
          ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-swoono-accent/40"
          : "bg-white/[0.02] border-white/5 cursor-not-allowed opacity-70"
      }`}
    >
      <div className="text-2xl leading-none mb-2">{game.emoji}</div>
      <div className="text-sm text-swoono-ink leading-tight">{game.name}</div>
      <div className="mt-1 flex items-center gap-1">
        <span className="text-[9px] uppercase tracking-wider text-swoono-dim/70">
          {game.category === "couples" ? "Couples" : "Classic"}
        </span>
        {locked && (
          <span className="text-[9px] uppercase tracking-wider text-swoono-accent2/80">
            · Tier {game.tier}
          </span>
        )}
      </div>
    </button>
  );
}
