import { useEffect } from "react";
import { useGameSession } from "../../../../hooks/useGameSession";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";

type TugOfWarState = {
  position: number; // 0-100, starts at 50
  player1_taps: number;
  player2_taps: number;
  status: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  time_remaining: number;
  player1_id: string;
  player2_id: string;
};

export default function TugOfWarGame({
  roomCode,
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const { gameState, updateGameState, createSession } = useGameSession(roomCode);

  // Initialize game session if needed
  useEffect(() => {
    if (!gameState) {
      createSession('tug-of-war', selfClientId);
    }
  }, [gameState, createSession, selfClientId]);

  // Game timer
  useEffect(() => {
    if (!gameState || gameState.game_state.status !== 'playing') return;

    const timer = setInterval(() => {
      const state = gameState.game_state as TugOfWarState;
      if (state.time_remaining > 0) {
        updateGameState({
          ...state,
          time_remaining: state.time_remaining - 1
        });
      } else {
        // Time's up - determine winner by position
        const winner = state.position >= 80
          ? state.player1_id
          : state.position <= 20
            ? state.player2_id
            : state.position > 50
              ? state.player1_id
              : state.player2_id;

        updateGameState({
          ...state,
          status: 'finished',
          winner,
          time_remaining: 0
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, updateGameState]);

  // Award points on game end
  useEffect(() => {
    if (!gameState) return;
    const state = gameState.game_state as TugOfWarState;
    if (state.status === 'finished' && state.winner) {
      if (state.winner === selfClientId) {
        onAwardPoints(15, "Tug of War win");
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
    }
  }, [gameState, selfClientId, onAwardPoints]);

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Starting Tug of War…
      </div>
    );
  }

  const state = gameState.game_state as TugOfWarState;
  const isPlayer1 = selfClientId === state.player1_id;
  const canTap = state.status === 'playing';

  const handleTap = async () => {
    if (!canTap) return;

    const newTaps = isPlayer1 ? state.player1_taps + 1 : state.player2_taps + 1;
    const tapDiff = isPlayer1
      ? (state.player1_taps + 1) - state.player2_taps
      : state.player2_taps - (state.player1_taps + 1);

    const newPosition = Math.max(0, Math.min(100, 50 + tapDiff));

    // Check for immediate win
    let winner = null;
    if (newPosition >= 80) winner = state.player1_id;
    if (newPosition <= 20) winner = state.player2_id;

    await updateGameState({
      ...state,
      position: newPosition,
      player1_taps: isPlayer1 ? newTaps : state.player1_taps,
      player2_taps: isPlayer1 ? state.player2_taps : newTaps,
      status: winner ? 'finished' : state.status,
      winner
    });
  };

  const startGame = async () => {
    await updateGameState({
      position: 50,
      player1_taps: 0,
      player2_taps: 0,
      status: 'playing',
      winner: null,
      time_remaining: 30,
      player1_id: state.player1_id,
      player2_id: state.player2_id
    });
  };

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

      {state.status === 'waiting' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <h3 className="text-2xl text-swoono-ink mb-4">Ready to Pull?</h3>
            <p className="text-swoono-dim mb-6">First to 80% wins, or most pulls in 30 seconds!</p>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-swoono-accent text-black font-bold rounded-xl text-lg hover:bg-swoono-accent/80 transition-colors"
            >
              START TUG OF WAR
            </button>
          </div>
        </div>
      )}

      {(state.status === 'playing' || state.status === 'finished') && (
        <>
          {/* Timer */}
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-swoono-accent">
              {state.time_remaining}
            </div>
            <div className="text-swoono-dim text-sm">seconds remaining</div>
          </div>

          {/* Rope and Position */}
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            {/* Position Indicator */}
            <div className="w-full max-w-lg mb-8">
              <div className="relative h-4 bg-gray-800 rounded-full border border-white/20">
                <div
                  className="absolute top-0 w-6 h-6 -mt-1 bg-yellow-400 rounded-full border-2 border-white shadow-lg transition-all duration-200"
                  style={{
                    left: `${Math.max(0, Math.min(94, state.position - 3))}%`,
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.6)'
                  }}
                />
                {/* Zone markers */}
                <div className="absolute left-0 top-0 w-[20%] h-full bg-red-500/30 rounded-l-full" />
                <div className="absolute right-0 top-0 w-[20%] h-full bg-blue-500/30 rounded-r-full" />
              </div>
              <div className="flex justify-between mt-2 text-xs text-swoono-dim">
                <span className="text-red-400">P2 WIN ZONE</span>
                <span className="text-blue-400">P1 WIN ZONE</span>
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
                  onClick={isPlayer1 ? handleTap : undefined}
                  disabled={!canTap || !isPlayer1}
                  className={`w-24 h-24 rounded-full font-bold text-lg transition-all ${
                    isPlayer1 && canTap
                      ? 'bg-blue-500 text-white hover:bg-blue-400 active:scale-95 shadow-lg shadow-blue-500/50'
                      : 'bg-blue-500/30 text-blue-300 cursor-not-allowed'
                  }`}
                >
                  TAP
                </button>
                <div className="text-xs text-swoono-dim mt-2">
                  {state.player1_taps} taps
                </div>
              </div>

              {/* Player 2 (Right/Red) */}
              <div className="flex flex-col items-center">
                <div className={`text-sm mb-2 ${!isPlayer1 ? 'text-red-400' : 'text-swoono-dim'}`}>
                  {!isPlayer1 ? 'YOU' : 'OPPONENT'}
                </div>
                <button
                  onClick={!isPlayer1 ? handleTap : undefined}
                  disabled={!canTap || isPlayer1}
                  className={`w-24 h-24 rounded-full font-bold text-lg transition-all ${
                    !isPlayer1 && canTap
                      ? 'bg-red-500 text-white hover:bg-red-400 active:scale-95 shadow-lg shadow-red-500/50'
                      : 'bg-red-500/30 text-red-300 cursor-not-allowed'
                  }`}
                >
                  TAP
                </button>
                <div className="text-xs text-swoono-dim mt-2">
                  {state.player2_taps} taps
                </div>
              </div>
            </div>
          </div>

          {/* Game Over */}
          {state.status === 'finished' && (
            <div className="text-center p-6 bg-black/50 m-4 rounded-xl border border-white/10">
              <h3 className="text-2xl font-bold text-swoono-ink mb-2">
                {state.winner === selfClientId ? '🎉 You Won!' : '😅 You Lost!'}
              </h3>
              <p className="text-swoono-dim">
                Final Position: {state.position}%
                {state.position >= 80 ? ' (Player 1 Victory!)' :
                 state.position <= 20 ? ' (Player 2 Victory!)' :
                 ` (Time's Up - ${state.position > 50 ? 'Player 1' : 'Player 2'} Wins!)`}
              </p>
              <button
                onClick={startGame}
                className="mt-4 px-6 py-2 bg-swoono-accent text-black font-semibold rounded hover:bg-swoono-accent/80 transition-colors"
              >
                Play Again
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}