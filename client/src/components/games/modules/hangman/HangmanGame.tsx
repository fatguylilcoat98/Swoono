import { useEffect } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

export default function HangmanGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const guessLetter = useRoomStore((s) => s.guessLetter);
  const game =
    activeGame && activeGame.gameId === "hangman" ? activeGame : null;

  useEffect(() => {
    if (!game || game.winner === null) return;

    // Cooperative — both players share the outcome.
    if (game.winner === "win") {
      onAwardPoints(12, "Hangman win");
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
  }, [game?.winner]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Starting game…
      </div>
    );
  }

  const currentTurnPlayer = game.players[game.nextPlayerIdx];
  const myTurn =
    currentTurnPlayer?.clientId === selfClientId && game.winner === null;
  const partner = game.players.find((p) => p.clientId !== selfClientId);

  const guessedSet = new Set(game.guessedLetters);
  const revealed = game.word
    .split("")
    .map((ch) => (guessedSet.has(ch) ? ch : "_"));

  const wrongGuesses = game.guessedLetters.filter(
    (l) => !game.word.includes(l),
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Hangman</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            Cooperative
            {partner && (
              <>
                {" "}
                · with <span className="text-swoono-ink">{partner.name}</span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={onExit}
          className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
        >
          Exit
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <TurnBanner
          game={game}
          myTurn={myTurn}
          currentPlayerName={currentTurnPlayer?.name}
        />

        <div className="flex items-center gap-2">
          {Array.from({ length: game.maxWrong }, (_, i) => (
            <span
              key={i}
              className="text-2xl"
              style={{
                opacity: i < game.maxWrong - game.wrongCount ? 1 : 0.2,
                filter:
                  i < game.maxWrong - game.wrongCount
                    ? "drop-shadow(0 0 6px rgb(var(--swoono-accent) / 0.7))"
                    : "grayscale(1)",
              }}
            >
              ❤️
            </span>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap justify-center max-w-md">
          {revealed.map((ch, i) => (
            <div
              key={i}
              className="w-8 h-12 border-b-2 border-swoono-accent flex items-center justify-center text-2xl font-display font-bold text-swoono-ink"
            >
              {ch === "_" ? "" : ch.toUpperCase()}
            </div>
          ))}
        </div>

        {wrongGuesses.length > 0 && (
          <p className="text-swoono-dim text-[11px] uppercase tracking-widest">
            Wrong:{" "}
            <span className="font-mono text-red-300/90">
              {wrongGuesses.join(" ")}
            </span>
          </p>
        )}

        <div className="grid grid-cols-7 gap-1.5 max-w-md w-full">
          {ALPHABET.map((letter) => {
            const used = guessedSet.has(letter);
            const tappable = myTurn && !used;
            return (
              <button
                key={letter}
                type="button"
                onClick={() => tappable && guessLetter(letter)}
                disabled={!tappable}
                className={`aspect-square rounded-lg border font-mono text-sm uppercase transition-all ${
                  used
                    ? "border-white/5 bg-white/[0.02] text-swoono-dim/40 cursor-not-allowed"
                    : tappable
                      ? "border-white/10 bg-white/5 text-swoono-ink hover:bg-white/10 hover:border-swoono-accent/40"
                      : "border-white/10 bg-white/5 text-swoono-dim/60 cursor-not-allowed"
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {game.winner && (
          <p className="text-center text-sm text-swoono-dim mt-2">
            The word was{" "}
            <span className="font-display text-swoono-accent uppercase tracking-widest">
              {game.word}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function TurnBanner({
  game,
  myTurn,
  currentPlayerName,
}: {
  game: { winner: "win" | "lose" | null };
  myTurn: boolean;
  currentPlayerName: string | undefined;
}) {
  if (game.winner === "win") {
    return <p className="text-swoono-ink text-lg font-medium">You got it!</p>;
  }
  if (game.winner === "lose") {
    return (
      <p className="text-swoono-dim text-lg font-medium">Out of guesses.</p>
    );
  }
  return (
    <p className="text-swoono-dim text-xs uppercase tracking-widest">
      {myTurn
        ? "Your turn — pick a letter"
        : `${currentPlayerName ?? "Partner"}'s turn`}
    </p>
  );
}
