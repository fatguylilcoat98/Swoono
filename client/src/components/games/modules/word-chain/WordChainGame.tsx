import { useEffect, useState } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { WordChainState } from "../../../../lib/types";

// Turn-based word chain. Each word must start with the last letter of
// the previous word. No repeats. Forfeit = you lose.
// Honor system — no dictionary validation, we trust both players.

export default function WordChainGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const game: WordChainState | null =
    activeGame && activeGame.gameId === "word-chain" ? activeGame : null;
  const submitWord = useRoomStore((s) => s.submitWordChainWord);
  const forfeit = useRoomStore((s) => s.forfeitWordChain);

  const [input, setInput] = useState("");
  const [awarded, setAwarded] = useState(false);
  const [localError, setLocalError] = useState("");

  const myIdx: 0 | 1 | null = game
    ? game.players[0].clientId === selfClientId
      ? 0
      : game.players[1].clientId === selfClientId
        ? 1
        : null
    : null;
  const myTurn = game && myIdx !== null && game.turnIdx === myIdx;

  // Clear input + error when turn flips
  useEffect(() => {
    setInput("");
    setLocalError("");
  }, [game?.turnIdx, game?.history.length]);

  useEffect(() => {
    if (!game || game.winnerIdx === null || awarded) return;
    setAwarded(true);
    const iWon = game.winnerIdx === myIdx;
    if (iWon) {
      onAwardPoints(18, "word-chain win");
      triggerEffect({
        effectId: "effect.game.win",
        fromClientId: selfClientId,
      });
    } else {
      triggerEffect({
        effectId: "effect.game.lose",
        fromClientId: selfClientId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.winnerIdx]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Starting game…
      </div>
    );
  }

  const opponent = game.players[myIdx === 0 ? 1 : 0];
  const done = game.winnerIdx !== null;

  const handleSubmit = () => {
    const raw = input.trim().toLowerCase();
    if (!raw) return;
    if (raw.length < 2) {
      setLocalError("Word must be at least 2 letters");
      return;
    }
    if (!/^[a-z]+$/.test(raw)) {
      setLocalError("Letters only");
      return;
    }
    if (raw[0] !== game.nextLetter.toLowerCase()) {
      setLocalError(`Must start with "${game.nextLetter}"`);
      return;
    }
    if (game.history.some((h) => h.word === raw)) {
      setLocalError("Already used");
      return;
    }
    setLocalError("");
    submitWord(raw);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Word Chain</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {done
              ? game.winnerIdx === myIdx
                ? "You won"
                : "You lost"
              : myTurn
                ? "Your turn"
                : "Opponent's turn"}
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

      <div className="flex items-center justify-center text-xs uppercase tracking-widest text-swoono-dim mb-4">
        Words in chain:{" "}
        <span className="text-swoono-accent ml-2">{game.history.length}</span>
      </div>

      {!done && (
        <div className="mb-6 flex flex-col items-center gap-2">
          <p className="text-swoono-dim text-[10px] uppercase tracking-widest">
            Next word must start with
          </p>
          <div
            className="text-6xl font-display font-bold text-swoono-accent"
            style={{
              textShadow: "0 0 20px rgb(var(--swoono-accent) / 0.7)",
            }}
          >
            {game.nextLetter}
          </div>
        </div>
      )}

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-4xl">{game.winnerIdx === myIdx ? "🏆" : "💭"}</div>
          <p className="text-xl text-swoono-ink">
            {game.winnerIdx === myIdx
              ? `${opponent?.name ?? "They"} forfeited — you win!`
              : "You forfeited the round."}
          </p>
          <p className="text-swoono-dim text-sm">
            Chain length: {game.history.length} words
          </p>
          <button
            onClick={onExit}
            className="mt-4 px-6 py-3 bg-swoono-accent text-black uppercase tracking-widest text-xs font-semibold rounded"
          >
            Back to games
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 mb-4 overflow-y-auto max-h-40 space-y-1 px-2">
            {game.history.length === 0 ? (
              <p className="text-swoono-dim text-xs text-center py-4">
                No words yet — play the first one!
              </p>
            ) : (
              game.history
                .slice()
                .reverse()
                .map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm bg-white/[0.03] rounded px-3 py-1"
                  >
                    <span className="text-swoono-ink font-mono uppercase">
                      {entry.word}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-widest"
                      style={{
                        color: entry.playerIdx === 0 ? "#22d3ee" : "#f472b6",
                      }}
                    >
                      P{entry.playerIdx + 1}
                    </span>
                  </div>
                ))
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) =>
                setInput(e.target.value.replace(/[^a-zA-Z]/g, "").toLowerCase())
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              disabled={!myTurn}
              placeholder={myTurn ? `${game.nextLetter}...` : "Waiting…"}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded text-swoono-ink placeholder:text-swoono-dim/50 focus:outline-none focus:border-swoono-accent/50 disabled:opacity-50 uppercase font-mono"
              autoCapitalize="none"
              autoComplete="off"
            />
            <button
              onClick={handleSubmit}
              disabled={!myTurn || !input.trim()}
              className="px-5 py-3 bg-swoono-accent text-black font-semibold uppercase tracking-widest text-xs rounded disabled:opacity-30"
            >
              Play
            </button>
          </div>
          {localError && (
            <p className="text-[11px] text-red-400 mt-2 text-center">
              {localError}
            </p>
          )}
          {myTurn && (
            <button
              onClick={() => {
                if (window.confirm("Forfeit this round? You'll lose.")) {
                  forfeit();
                }
              }}
              className="mt-4 text-[10px] uppercase tracking-widest text-swoono-dim hover:text-red-400 transition-colors"
            >
              Can't think of one — forfeit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
