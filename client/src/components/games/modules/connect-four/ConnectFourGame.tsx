import { useEffect } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { ConnectFourSide } from "../../../../lib/types";

const ROWS = 6;
const COLS = 7;

export default function ConnectFourGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const dropColumn = useRoomStore((s) => s.dropColumn);
  const game =
    activeGame && activeGame.gameId === "connect-four" ? activeGame : null;

  useEffect(() => {
    if (!game || game.winner === null) return;
    if (game.winner === "draw") return;

    const mySide: ConnectFourSide | null =
      game.players.red.clientId === selfClientId
        ? "red"
        : game.players.yellow.clientId === selfClientId
          ? "yellow"
          : null;
    if (!mySide) return;

    if (game.winner === mySide) {
      onAwardPoints(15, "Connect Four win");
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

  const mySide: ConnectFourSide | null =
    game.players.red.clientId === selfClientId
      ? "red"
      : game.players.yellow.clientId === selfClientId
        ? "yellow"
        : null;
  const myTurn =
    mySide !== null && game.nextPlayer === mySide && game.winner === null;
  const opponent =
    mySide === "red"
      ? game.players.yellow
      : mySide === "yellow"
        ? game.players.red
        : null;

  function canDropIn(col: number): boolean {
    if (!game) return false;
    return game.board[col] === null; // top row empty = column not full
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Connect Four</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            You are{" "}
            <span
              style={{
                color: mySide === "red" ? "#ff4d4d" : "#ffd44d",
                fontWeight: 700,
              }}
            >
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

      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-2">
        <TurnBanner game={game} mySide={mySide} />

        <div className="flex flex-col gap-1 bg-white/5 border border-white/10 p-2 rounded-xl w-full max-w-xs mx-auto">
          {Array.from({ length: ROWS }, (_, row) => (
            <div key={row} className="flex gap-1">
              {Array.from({ length: COLS }, (_, col) => {
                const idx = row * COLS + col;
                const cell = game.board[idx];
                const tappable = myTurn && canDropIn(col);
                const winning = game.winningLine?.includes(idx);
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => tappable && dropColumn(col)}
                    disabled={!tappable}
                    className={`aspect-square flex-1 min-w-0 rounded-full border transition-all ${
                      tappable
                        ? "border-white/20 hover:border-swoono-accent/60 cursor-pointer active:scale-95"
                        : "border-white/10 cursor-default"
                    } ${winning ? "ring-2 ring-white/80" : ""}`}
                    style={{
                      background:
                        cell === "red"
                          ? "radial-gradient(circle at 35% 30%, #ff9090, #ff1744)"
                          : cell === "yellow"
                            ? "radial-gradient(circle at 35% 30%, #fff59d, #ffc107)"
                            : "rgb(10 6 20 / 0.55)",
                      boxShadow: cell
                        ? `inset 0 2px 6px rgba(0,0,0,0.5)`
                        : "inset 0 2px 4px rgba(0,0,0,0.5)",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TurnBanner({
  game,
  mySide,
}: {
  game: {
    winner: ConnectFourSide | "draw" | null;
    nextPlayer: ConnectFourSide;
  };
  mySide: ConnectFourSide | null;
}) {
  if (game.winner === "draw") {
    return (
      <p className="text-swoono-ink text-lg font-medium">It&apos;s a draw.</p>
    );
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
      {myTurn ? "Your turn — drop in a column" : "Opponent's turn"}
    </p>
  );
}
