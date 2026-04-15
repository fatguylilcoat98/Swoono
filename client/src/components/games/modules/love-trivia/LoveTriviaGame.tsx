import { useEffect, useState } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { LoveTriviaState } from "../../../../lib/types";

// Cooperative couples game: both players pick what they think their
// partner would answer. Matching answers score together. 10 rounds.
// The server owns all state — this component is pure render + input.

export default function LoveTriviaGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const game: LoveTriviaState | null =
    activeGame && activeGame.gameId === "love-trivia" ? activeGame : null;
  const submitAnswer = useRoomStore((s) => s.submitLoveTriviaAnswer);

  const [awarded, setAwarded] = useState(false);

  const myIdx: 0 | 1 | null = game
    ? game.players[0].clientId === selfClientId
      ? 0
      : game.players[1].clientId === selfClientId
        ? 1
        : null
    : null;

  const myAnswer =
    game && myIdx !== null ? game.currentAnswers[myIdx] : null;
  const partnerIdx = myIdx === 0 ? 1 : 0;
  const partnerAnswered =
    game && myIdx !== null ? game.currentAnswers[partnerIdx] !== null : false;

  // Show the previous round's result for ~1.5s after it resolves
  const [showLastResult, setShowLastResult] = useState<{
    matched: boolean;
    myChoice: number;
    partnerChoice: number;
  } | null>(null);

  useEffect(() => {
    if (!game || myIdx === null) return;
    const lastRound = game.history[game.history.length - 1];
    if (!lastRound) {
      setShowLastResult(null);
      return;
    }
    // Only briefly flash the result after it lands
    setShowLastResult({
      matched: lastRound.matched,
      myChoice: lastRound.answers[myIdx],
      partnerChoice: lastRound.answers[partnerIdx],
    });
    const t = window.setTimeout(() => setShowLastResult(null), 1800);
    return () => window.clearTimeout(t);
  }, [game?.history.length, myIdx, partnerIdx]);

  // Fire win/lose effect + points once on completion
  useEffect(() => {
    if (!game || game.winner !== "done" || awarded || myIdx === null) return;
    setAwarded(true);
    const pts = Math.min(20, game.matchedCount * 2);
    if (game.matchedCount >= 6) {
      onAwardPoints(pts, `Love Trivia ${game.matchedCount}/10`);
      triggerEffect({
        effectId: "effect.game.win",
        fromClientId: selfClientId,
      });
    } else if (game.matchedCount >= 3) {
      onAwardPoints(pts, `Love Trivia ${game.matchedCount}/10`);
    } else {
      triggerEffect({
        effectId: "effect.game.lose",
        fromClientId: selfClientId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.winner]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Starting game…
      </div>
    );
  }

  const opponent = game.players[partnerIdx];
  const question = game.questions[game.currentIdx] || null;
  const done = game.winner === "done";

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Love Trivia</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {done
              ? game.matchedCount >= 6
                ? "You two are in sync"
                : game.matchedCount >= 3
                  ? "Close — keep learning each other"
                  : "Lots to discover"
              : `Round ${game.currentIdx + 1} of ${game.questions.length}`}
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

      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-swoono-dim mb-4">
        <span>
          Matches{" "}
          <span className="text-swoono-accent">
            {game.matchedCount} / {game.history.length || game.currentIdx}
          </span>
        </span>
        <span>
          Final goal{" "}
          <span className="text-swoono-accent">
            {game.questions.length}
          </span>
        </span>
      </div>

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-5xl font-display text-swoono-accent">
            {game.matchedCount} / {game.questions.length}
          </div>
          <p className="text-swoono-ink">
            You agreed on {game.matchedCount} out of {game.questions.length} —{" "}
            {Math.round((game.matchedCount / game.questions.length) * 100)}% in
            sync.
          </p>
          <button
            onClick={onExit}
            className="mt-6 px-6 py-3 bg-swoono-accent text-black uppercase tracking-widest text-xs font-semibold rounded"
          >
            Back to games
          </button>
        </div>
      ) : question ? (
        <div className="flex-1 flex flex-col">
          <div className="mb-6 text-center">
            <p className="text-swoono-dim text-xs uppercase tracking-widest mb-2">
              Pick what your partner would choose
            </p>
            <p className="text-swoono-ink text-xl leading-snug">
              {question.text}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {question.choices.map((choice, idx) => {
              const isMine = myAnswer === idx;
              const disabled = myAnswer !== null;
              return (
                <button
                  key={idx}
                  onClick={() => !disabled && submitAnswer(idx)}
                  disabled={disabled}
                  className={`px-4 py-4 rounded-lg border text-sm text-left transition-colors ${
                    isMine
                      ? "bg-swoono-accent/20 border-swoono-accent text-swoono-accent"
                      : disabled
                        ? "bg-white/5 border-white/10 text-swoono-dim cursor-not-allowed"
                        : "bg-white/5 border-white/10 text-swoono-ink hover:bg-white/10 hover:border-swoono-accent/40"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          <div className="text-center text-[11px] uppercase tracking-widest text-swoono-dim min-h-[20px]">
            {myAnswer === null
              ? "Tap your answer"
              : partnerAnswered
                ? "Revealing…"
                : `Waiting on ${opponent?.name ?? "partner"}…`}
          </div>

          {showLastResult && (
            <div
              className="mt-4 text-center text-sm font-semibold"
              style={{
                color: showLastResult.matched ? "#39FF14" : "#FF0055",
              }}
            >
              {showLastResult.matched
                ? "✓ You two matched!"
                : "✗ Different answers that round"}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
