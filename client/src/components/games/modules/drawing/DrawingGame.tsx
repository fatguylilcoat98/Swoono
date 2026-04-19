import { useEffect } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { DrawingGameState, DrawingStroke } from "../../../../lib/types";
import DrawingCanvas from "./DrawingCanvas";
import DrawingReveal from "./DrawingReveal";
import JudgePanel from "./JudgePanel";

export default function DrawingGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const makeDrawingMove = useRoomStore((s) => s.makeDrawingMove);
  const game = activeGame && activeGame.gameId === "drawing" ? activeGame : null;

  // Handle phase completion effects
  useEffect(() => {
    if (!game) return;

    if (game.phase === "complete") {
      // Award points for completion
      onAwardPoints(15, "Drawing game completed");
      triggerEffect({
        effectId: "effect.game.win",
        fromClientId: selfClientId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Starting drawing game…
      </div>
    );
  }

  const myPlayer = game.players[selfClientId];
  const otherPlayer = Object.values(game.players).find(p => p !== myPlayer);

  const handleStrokeComplete = (stroke: DrawingStroke) => {
    makeDrawingMove("add-stroke", stroke);
  };

  const handleReadyForReveal = () => {
    makeDrawingMove("ready-for-reveal");
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Drawing Together</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            Phase: <span className="text-swoono-accent font-semibold">{game.phase}</span>
            {otherPlayer && (
              <>
                {" "}· vs <span className="text-swoono-ink">{otherPlayer.name}</span>
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

      <div className="flex-1 flex flex-col">
        {/* Prompt */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <h3 className="text-lg font-display text-swoono-ink mb-2">Draw this:</h3>
          <p className="text-swoono-accent text-xl font-medium">{game.prompt}</p>
        </div>

        {/* Timer (only during drawing phase) */}
        {game.phase === "drawing" && (
          <div className="text-center mb-6">
            <div className="text-2xl font-display text-swoono-accent">
              {formatTime(game.timeRemaining)}
            </div>
            <div className="text-xs text-swoono-dim uppercase tracking-widest mt-1">
              Time remaining
            </div>
          </div>
        )}

        {/* Phase-specific content */}
        {game.phase === "drawing" && (
          <DrawingPhase
            game={game}
            myPlayer={myPlayer}
            onStrokeComplete={handleStrokeComplete}
            onReadyForReveal={handleReadyForReveal}
          />
        )}

        {game.phase === "reveal" && (
          <DrawingReveal game={game} selfClientId={selfClientId} />
        )}

        {(game.phase === "judging" || game.phase === "complete") && (
          <JudgePanel game={game} selfClientId={selfClientId} />
        )}
      </div>
    </div>
  );
}

function DrawingPhase({
  game,
  myPlayer,
  onStrokeComplete,
  onReadyForReveal,
}: {
  game: DrawingGameState;
  myPlayer: DrawingGameState["players"][string];
  onStrokeComplete: (stroke: DrawingStroke) => void;
  onReadyForReveal: () => void;
}) {
  const canMarkReady = game.timeRemaining <= 0 || myPlayer.drawing.strokes.length > 0;
  const allReady = Object.values(game.players).every(p => p.readyForReveal);
  const otherReady = Object.values(game.players).some(p => p !== myPlayer && p.readyForReveal);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
        <DrawingCanvas
          strokes={myPlayer.drawing.strokes}
          onStrokeComplete={onStrokeComplete}
          disabled={game.timeRemaining <= 0}
        />
      </div>

      {/* Ready controls */}
      <div className="text-center">
        {!myPlayer.readyForReveal ? (
          <button
            onClick={onReadyForReveal}
            disabled={!canMarkReady}
            className={`px-6 py-3 rounded-xl font-medium transition-colors ${
              canMarkReady
                ? "bg-swoono-accent text-white hover:bg-swoono-accent/90"
                : "bg-white/5 text-swoono-dim cursor-not-allowed"
            }`}
          >
            {game.timeRemaining <= 0 ? "Time's Up! Ready to Reveal" : "Done Drawing"}
          </button>
        ) : (
          <div className="text-swoono-accent text-sm">
            ✓ Ready for reveal
            {otherReady && !allReady && (
              <div className="text-swoono-dim text-xs mt-1">
                Waiting for other player...
              </div>
            )}
            {allReady && (
              <div className="text-swoono-dim text-xs mt-1">
                Both ready! Revealing drawings...
              </div>
            )}
          </div>
        )}

        {otherReady && !myPlayer.readyForReveal && (
          <div className="text-swoono-dim text-xs mt-2">
            Other player is ready to reveal
          </div>
        )}
      </div>
    </div>
  );
}