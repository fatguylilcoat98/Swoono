import { useEffect, useState } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { TriviaState } from "../../../../lib/types";

// Competitive trivia. Both players see the same question; first to
// tap the correct answer wins that round's 10 points. Wrong answer
// locks you out of that round. 10 rounds total.

export default function TriviaGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const game: TriviaState | null =
    activeGame && activeGame.gameId === "trivia" ? activeGame : null;
  const submitAnswer = useRoomStore((s) => s.submitTriviaAnswer);

  const [awarded, setAwarded] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<null | {
    right: boolean;
  }>(null);

  const myIdx: 0 | 1 | null = game
    ? game.players[0].clientId === selfClientId
      ? 0
      : game.players[1].clientId === selfClientId
        ? 1
        : null
    : null;

  const amLockedOut =
    game && myIdx !== null ? game.lockedOut[myIdx] : false;

  // Clear feedback when round changes
  useEffect(() => {
    setLastFeedback(null);
  }, [game?.currentIdx]);

  useEffect(() => {
    if (!game || game.winner === null || awarded || myIdx === null) return;
    setAwarded(true);
    if (game.winner === "win" && game.winnerIdx === myIdx) {
      onAwardPoints(20, "trivia win");
      triggerEffect({
        effectId: "effect.game.win",
        fromClientId: selfClientId,
      });
    } else if (game.winner === "win" && game.winnerIdx !== myIdx) {
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

  const opponent = game.players[myIdx === 0 ? 1 : 0];
  const done = game.winner !== null;
  const question = game.questions[game.currentIdx] || null;
  const myScore = myIdx !== null ? game.scores[myIdx] : 0;
  const oppScore = myIdx !== null ? game.scores[myIdx === 0 ? 1 : 0] : 0;

  const handleChoice = (idx: number) => {
    if (amLockedOut || !question) return;
    setLastFeedback({ right: idx === question.correctIdx });
    submitAnswer(idx);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Trivia</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {done
              ? game.winner === "draw"
                ? "It's a draw"
                : game.winnerIdx === myIdx
                  ? "You won"
                  : "You lost"
              : `Question ${game.currentIdx + 1} of ${game.questions.length}`}
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

      <div className="flex items-center justify-between text-xs uppercase tracking-widest mb-4">
        <span className="text-cyan-300">You: {myScore}</span>
        <span className="text-pink-300">Opp: {oppScore}</span>
      </div>

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-5xl">
            {game.winner === "draw"
              ? "🤝"
              : game.winnerIdx === myIdx
                ? "🏆"
                : "💭"}
          </div>
          <p className="text-xl text-swoono-ink">
            {game.winner === "draw"
              ? `Tied at ${myScore}–${oppScore}`
              : game.winnerIdx === myIdx
                ? `You won ${myScore}–${oppScore}`
                : `You lost ${myScore}–${oppScore}`}
          </p>
          <button
            onClick={onExit}
            className="mt-4 px-6 py-3 bg-swoono-accent text-black uppercase tracking-widest text-xs font-semibold rounded"
          >
            Back to games
          </button>
        </div>
      ) : question ? (
        <div className="flex-1 flex flex-col">
          {question.category && (
            <p className="text-center text-[10px] uppercase tracking-widest text-swoono-accent mb-2">
              {question.category}
            </p>
          )}
          <p className="text-center text-xl text-swoono-ink leading-snug mb-6 px-2">
            {question.text}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {question.choices.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => handleChoice(idx)}
                disabled={amLockedOut}
                className={`px-4 py-4 rounded-lg border text-sm text-left transition-colors ${
                  amLockedOut
                    ? "bg-white/5 border-white/10 text-swoono-dim cursor-not-allowed"
                    : "bg-white/5 border-white/10 text-swoono-ink hover:bg-white/10 hover:border-swoono-accent/40"
                }`}
              >
                {choice}
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] uppercase tracking-widest text-swoono-dim min-h-[18px]">
            {amLockedOut
              ? lastFeedback?.right === false
                ? "Wrong — locked out this round"
                : "Waiting for next round…"
              : "First correct answer wins the round"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
