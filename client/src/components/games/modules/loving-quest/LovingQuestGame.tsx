import { useEffect, useState } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { LovingQuestState } from "../../../../lib/types";

// Cooperative sequence. 6 prompts. Both players tap Done to advance.
// No scoring — it's an experience, not a competition.

export default function LovingQuestGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const game: LovingQuestState | null =
    activeGame && activeGame.gameId === "loving-quest" ? activeGame : null;
  const markDone = useRoomStore((s) => s.markLovingQuestDone);

  const [awarded, setAwarded] = useState(false);

  const myIdx: 0 | 1 | null = game
    ? game.players[0].clientId === selfClientId
      ? 0
      : game.players[1].clientId === selfClientId
        ? 1
        : null
    : null;

  useEffect(() => {
    if (!game || game.winner !== "done" || awarded) return;
    setAwarded(true);
    onAwardPoints(30, "loving-quest completed");
    triggerEffect({
      effectId: "effect.game.win",
      fromClientId: selfClientId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.winner]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Starting quest…
      </div>
    );
  }

  const opponent = game.players[myIdx === 0 ? 1 : 0];
  const done = game.winner === "done";
  const prompt = game.prompts[game.currentIdx];
  const iDone = myIdx !== null ? game.doneFlags[myIdx] : false;
  const otherDone =
    myIdx !== null ? game.doneFlags[myIdx === 0 ? 1 : 0] : false;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Loving Quest</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {done
              ? "Quest complete"
              : `Step ${game.currentIdx + 1} of ${game.prompts.length}`}
            {" · with "}
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

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-5xl">✨</div>
          <p className="text-xl text-swoono-ink">Quest complete.</p>
          <p className="text-swoono-dim text-sm max-w-sm">
            You two just spent real time with each other on purpose. That
            counts.
          </p>
          <button
            onClick={onExit}
            className="mt-4 px-6 py-3 bg-swoono-accent text-black uppercase tracking-widest text-xs font-semibold rounded"
          >
            Back to games
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 px-4">
          <p className="text-swoono-dim text-xs uppercase tracking-widest">
            Do this together
          </p>
          <p className="text-2xl text-swoono-ink leading-snug max-w-md">
            {prompt}
          </p>
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            <button
              onClick={markDone}
              disabled={iDone}
              className={`w-full py-4 rounded-lg border-2 uppercase tracking-widest text-sm font-semibold transition-colors ${
                iDone
                  ? "border-swoono-accent/40 bg-swoono-accent/10 text-swoono-accent cursor-default"
                  : "border-swoono-accent text-swoono-ink hover:bg-swoono-accent/10"
              }`}
            >
              {iDone ? "✓ You're ready" : "Tap when done"}
            </button>
            <p className="text-[11px] uppercase tracking-widest text-swoono-dim">
              {iDone && otherDone
                ? "Both ready — moving on…"
                : iDone
                  ? `Waiting on ${opponent?.name ?? "partner"}`
                  : otherDone
                    ? `${opponent?.name ?? "Partner"} is ready`
                    : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
