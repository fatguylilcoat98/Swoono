import { useEffect } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import { getSocket } from "../../../../lib/socket";

export default function TugOfWarGame({
  onExit,
  onAwardPoints,
}: GameContextProps) {
  // Use Socket.IO pattern like existing games
  const activeGame = useRoomStore((s) => s.activeGame);
  const clientId = useRoomStore((s) => s.clientId);

  // For new games, we'll assume the server sends this structure
  const game = activeGame && (activeGame as any).gameId === "tug-of-war" ? activeGame as any : null;
  const socket = getSocket();

  // Award points on game end
  useEffect(() => {
    if (!game || !game.winner) return;

    if (game.winner === clientId) {
      onAwardPoints(15, "Tug of War win");
      triggerEffect({
        effectId: "effect.game.win",
        fromClientId: clientId,
      });
    } else {
      triggerEffect({
        effectId: "effect.game.lose",
        fromClientId: clientId,
      });
    }
  }, [game?.winner, clientId, onAwardPoints]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Waiting for game to start…
      </div>
    );
  }

  if (game.status === "waiting") {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-black via-gray-900 to-black">
        <div className="flex items-center justify-between mb-6 px-5 pt-5">
          <div>
            <h2 className="font-display text-2xl text-swoono-ink">Tug of War</h2>
            <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
              Pull the rope to victory
            </p>
          </div>
          <button
            onClick={onExit}
            className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
          >
            Exit
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <h3 className="text-2xl text-swoono-ink mb-4">Ready to Pull?</h3>
            <p className="text-swoono-dim mb-6">First player to pull the rope 5 spaces wins!</p>
            <div className="text-swoono-dim text-sm">
              Waiting for both players to join...
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPlayer1 = clientId === game.players?.[0];
  const canPlay = game.status === "active" && game.currentPlayer === clientId;

  const handlePull = () => {
    if (!canPlay) return;
    socket.emit("game:move", { type: "pull" });
  };

  // Convert position (-5 to +5) to percentage (0 to 100) for display
  const displayPosition = ((game.position + 5) / 10) * 100;

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="flex items-center justify-between mb-6 px-5 pt-5">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Tug of War</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            Position: {game.position || 0} / ±5
          </p>
        </div>
        <button
          onClick={onExit}
          className="text-swoono-dim text-xs uppercase tracking-widest hover:text-swoono-accent transition-colors"
        >
          Exit
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Turn Indicator */}
        <div className="text-center mb-6">
          <div className="text-lg text-swoono-accent">
            {game.status === "active"
              ? (canPlay ? "Your turn - PULL!" : "Opponent's turn")
              : "Game Over"
            }
          </div>
        </div>

        {/* Position Indicator */}
        <div className="w-full max-w-lg mb-8">
          <div className="relative h-6 bg-gray-800 rounded-full border border-white/20">
            <div
              className="absolute top-0 w-8 h-8 -mt-1 bg-yellow-400 rounded-full border-2 border-white shadow-lg transition-all duration-300"
              style={{
                left: `${Math.max(0, Math.min(92, displayPosition - 4))}%`,
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.6)'
              }}
            />
            {/* Zone markers */}
            <div className="absolute left-0 top-0 w-[10%] h-full bg-red-500/40 rounded-l-full" />
            <div className="absolute right-0 top-0 w-[10%] h-full bg-blue-500/40 rounded-r-full" />
          </div>
          <div className="flex justify-between mt-2 text-xs text-swoono-dim">
            <span className="text-red-400">P2 WINS (-5)</span>
            <span className="text-swoono-dim">CENTER (0)</span>
            <span className="text-blue-400">P1 WINS (+5)</span>
          </div>
        </div>

        {/* Rope Visual */}
        <div className="w-full max-w-lg h-8 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-800 via-amber-600 to-amber-800 rounded transform -skew-y-1 shadow-lg"
               style={{
                 backgroundImage: 'repeating-linear-gradient(90deg, #92400e 0px, #d97706 10px, #92400e 20px)',
                 filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
               }}
          />
        </div>

        {/* Players */}
        <div className="w-full max-w-lg flex justify-between items-center">
          {/* Player 1 (Left/Blue) */}
          <div className="flex flex-col items-center">
            <div className={`text-sm mb-2 ${isPlayer1 ? 'text-blue-400' : 'text-swoono-dim'}`}>
              {isPlayer1 ? 'YOU' : 'OPPONENT'}
            </div>
            <button
              onClick={isPlayer1 ? handlePull : undefined}
              disabled={!canPlay || !isPlayer1}
              className={`w-24 h-24 rounded-full font-bold text-lg transition-all ${
                isPlayer1 && canPlay
                  ? 'bg-blue-500 text-white hover:bg-blue-400 active:scale-95 shadow-lg shadow-blue-500/50'
                  : 'bg-blue-500/30 text-blue-300 cursor-not-allowed'
              }`}
            >
              PULL →
            </button>
            <div className="text-xs text-swoono-dim mt-2">
              Player 1
            </div>
          </div>

          {/* Player 2 (Right/Red) */}
          <div className="flex flex-col items-center">
            <div className={`text-sm mb-2 ${!isPlayer1 ? 'text-red-400' : 'text-swoono-dim'}`}>
              {!isPlayer1 ? 'YOU' : 'OPPONENT'}
            </div>
            <button
              onClick={!isPlayer1 ? handlePull : undefined}
              disabled={!canPlay || isPlayer1}
              className={`w-24 h-24 rounded-full font-bold text-lg transition-all ${
                !isPlayer1 && canPlay
                  ? 'bg-red-500 text-white hover:bg-red-400 active:scale-95 shadow-lg shadow-red-500/50'
                  : 'bg-red-500/30 text-red-300 cursor-not-allowed'
              }`}
            >
              ← PULL
            </button>
            <div className="text-xs text-swoono-dim mt-2">
              Player 2
            </div>
          </div>
        </div>

        {/* Game Over */}
        {game.status === "finished" && (
          <div className="text-center p-6 bg-black/50 m-4 rounded-xl border border-white/10 mt-8">
            <h3 className="text-2xl font-bold text-swoono-ink mb-2">
              {game.winner === clientId ? '🎉 You Won!' : '😅 You Lost!'}
            </h3>
            <p className="text-swoono-dim">
              Final Position: {game.position}
              {game.position >= 5 ? ' (Player 1 Victory!)' :
               game.position <= -5 ? ' (Player 2 Victory!)' :
               ' (Game ended)'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}