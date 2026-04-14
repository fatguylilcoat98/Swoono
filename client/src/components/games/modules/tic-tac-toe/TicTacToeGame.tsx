import { useEffect } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { TicTacToeSide, TicTacToeState } from "../../../../lib/types";

export default function TicTacToeGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const makeMove = useRoomStore((s) => s.makeMove);
  const game = activeGame && activeGame.gameId === "tic-tac-toe" ? activeGame : null;

  // Fire win/lose effect on the frame the winner becomes non-null.
  useEffect(() => {
    if (!game || game.winner === null) return;
    if (game.winner === "draw") return;

    const mySide: TicTacToeSide | null =
      game.players.X.clientId === selfClientId
        ? "X"
        : game.players.O.clientId === selfClientId
          ? "O"
          : null;
    if (!mySide) return;

    if (game.winner === mySide) {
      onAwardPoints(10, "Tic-Tac-Toe win");
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

  const mySide: TicTacToeSide | null =
    game.players.X.clientId === selfClientId
      ? "X"
      : game.players.O.clientId === selfClientId
        ? "O"
        : null;
  const myTurn =
    mySide !== null && game.nextPlayer === mySide && game.winner === null;
  const opponent =
    mySide === "X"
      ? game.players.O
      : mySide === "O"
        ? game.players.X
        : null;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Tic-Tac-Toe</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            You are{" "}
            <span className="text-swoono-accent font-semibold">
              {mySide ?? "spectator"}
            </span>
            {opponent && (
              <>
                {" "}
                · vs <span className="text-swoono-ink">{opponent.name}</span>
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
        <TurnBanner game={game} mySide={mySide} />
        <Board
          cells={game.board}
          disabled={!myTurn}
          onPlay={(i) => makeMove(i)}
        />
      </div>
    </div>
  );
}

function TurnBanner({
  game,
  mySide,
}: {
  game: TicTacToeState;
  mySide: TicTacToeSide | null;
}) {
  if (game.winner === "draw") {
    return <p className="text-swoono-ink text-lg font-medium">It&apos;s a draw.</p>;
  }
  if (game.winner) {
    return (
      <p className="text-swoono-dim text-sm uppercase tracking-widest">
        {game.winner === mySide ? "You won" : "Opponent won"}
      </p>
    );
  }
  const myTurn = mySide !== null && game.nextPlayer === mySide;
  return (
    <p className="text-swoono-dim text-xs uppercase tracking-widest">
      {myTurn ? "Your turn" : "Opponent's turn"}
    </p>
  );
}

function Board({
  cells,
  disabled,
  onPlay,
}: {
  cells: (TicTacToeSide | null)[];
  disabled: boolean;
  onPlay: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 max-w-sm w-full aspect-square">
      {cells.map((cell, i) => {
        const tappable = !disabled && cell === null;
        return (
          <button
            key={i}
            type="button"
            onClick={() => tappable && onPlay(i)}
            disabled={!tappable}
            className={`aspect-square rounded-xl border text-4xl md:text-5xl font-display font-bold transition-colors ${
              cell
                ? "bg-white/5 border-white/10"
                : tappable
                  ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-swoono-accent/40"
                  : "bg-white/[0.02] border-white/5 cursor-not-allowed"
            }`}
            style={{
              color:
                cell === "X"
                  ? "rgb(var(--swoono-accent))"
                  : cell === "O"
                    ? "rgb(var(--swoono-accent2))"
                    : undefined,
            }}
          >
            {cell ?? ""}
          </button>
        );
      })}
    </div>
  );
}
