import { useEffect, useState } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { PromptGameState } from "../../../../lib/types";

// Shared engine for Truth or Dare + Spicy Zone.
// Active player picks truth/dare, a prompt is revealed, they perform
// it, tap Done to advance. 10 rounds alternating.

type PromptGameProps = GameContextProps & {
  /** Which game id to lock onto — "truth-or-dare" or "spicy-zone" */
  gameId: "truth-or-dare" | "spicy-zone";
  title: string;
  subtitle: string;
};

export default function PromptGame({
  gameId,
  title,
  subtitle,
  selfClientId,
  onExit,
  onAwardPoints,
}: PromptGameProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const game: PromptGameState | null =
    activeGame && activeGame.gameId === gameId
      ? (activeGame as PromptGameState)
      : null;
  const pickPrompt = useRoomStore((s) => s.pickPrompt);
  const completePrompt = useRoomStore((s) => s.completePrompt);
  const skipPrompt = useRoomStore((s) => s.skipPrompt);

  const [awarded, setAwarded] = useState(false);

  const myIdx: 0 | 1 | null = game
    ? game.players[0].clientId === selfClientId
      ? 0
      : game.players[1].clientId === selfClientId
        ? 1
        : null
    : null;
  const myTurn = game && myIdx !== null && game.turnIdx === myIdx;

  useEffect(() => {
    if (!game || game.winner !== "win" || awarded) return;
    setAwarded(true);
    onAwardPoints(10, `${gameId} finished`);
    triggerEffect({
      effectId: "effect.game.win",
      fromClientId: selfClientId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.winner]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Starting game…
      </div>
    );
  }

  const opponent = game.players[myIdx === 0 ? 1 : 0];
  const done = game.winner === "win";

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">{title}</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {done
              ? "Well played"
              : `Round ${game.roundsCompleted + 1} of ${game.totalRounds}`}
            {" · vs "}
            <span className="text-swoono-ink">{opponent?.name}</span>
          </p>
        </div>
        <button
          onClick={onExit}
          className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
        >
          Exit
        </button>
      </div>

      <p className="text-center text-[10px] uppercase tracking-widest text-swoono-dim mb-4">
        {subtitle}
      </p>

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-4xl">💛</div>
          <p className="text-swoono-ink text-lg">
            You made it through all {game.totalRounds} rounds.
          </p>
          <button
            onClick={onExit}
            className="mt-4 px-6 py-3 bg-swoono-accent text-black uppercase tracking-widest text-xs font-semibold rounded"
          >
            Back to games
          </button>
        </div>
      ) : !game.currentPrompt ? (
        // Picking phase
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <p className="text-swoono-ink text-lg">
            {myTurn
              ? "Your turn — pick one:"
              : `Waiting on ${game.players[game.turnIdx].name}…`}
          </p>
          <div className="flex gap-4 w-full max-w-sm">
            <button
              onClick={() => myTurn && pickPrompt("truth")}
              disabled={!myTurn}
              className={`flex-1 py-6 rounded-lg border-2 text-lg font-semibold uppercase tracking-widest transition-colors ${
                myTurn
                  ? "border-cyan-400 text-cyan-300 hover:bg-cyan-400/10"
                  : "border-white/10 text-swoono-dim cursor-not-allowed"
              }`}
            >
              Truth
            </button>
            <button
              onClick={() => myTurn && pickPrompt("dare")}
              disabled={!myTurn}
              className={`flex-1 py-6 rounded-lg border-2 text-lg font-semibold uppercase tracking-widest transition-colors ${
                myTurn
                  ? "border-pink-400 text-pink-300 hover:bg-pink-400/10"
                  : "border-white/10 text-swoono-dim cursor-not-allowed"
              }`}
            >
              Dare
            </button>
          </div>
        </div>
      ) : (
        // Prompt revealed
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <div
            className="text-xs uppercase tracking-widest font-semibold"
            style={{
              color:
                game.currentPrompt.type === "truth" ? "#22d3ee" : "#f472b6",
            }}
          >
            {game.currentPrompt.type}
          </div>
          <p className="text-xl text-swoono-ink leading-relaxed max-w-md">
            {game.currentPrompt.text}
          </p>
          {myTurn ? (
            <div className="flex gap-3 mt-4">
              <button
                onClick={skipPrompt}
                className="px-5 py-3 border border-white/15 text-swoono-dim uppercase tracking-widest text-xs rounded hover:border-white/30"
              >
                Swap it
              </button>
              <button
                onClick={completePrompt}
                className="px-6 py-3 bg-swoono-accent text-black font-semibold uppercase tracking-widest text-xs rounded"
              >
                ✓ Done
              </button>
            </div>
          ) : (
            <p className="text-swoono-dim text-xs uppercase tracking-widest mt-4">
              Waiting on {game.players[game.turnIdx].name}…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
