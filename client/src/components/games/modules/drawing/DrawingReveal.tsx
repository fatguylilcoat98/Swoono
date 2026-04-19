import { useEffect, useRef } from "react";
import type { DrawingGameState, DrawingStroke } from "../../../../lib/types";

interface DrawingRevealProps {
  game: DrawingGameState;
  selfClientId: string;
}

export default function DrawingReveal({ game, selfClientId }: DrawingRevealProps) {
  const players = Object.entries(game.players);
  const myEntry = players.find(([id]) => id === selfClientId);
  const otherEntry = players.find(([id]) => id !== selfClientId);

  if (!myEntry || !otherEntry) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Loading drawings...
      </div>
    );
  }

  const [, myPlayer] = myEntry;
  const [, otherPlayer] = otherEntry;

  return (
    <div className="flex-1 flex flex-col">
      <div className="text-center mb-6">
        <h3 className="text-xl font-display text-swoono-ink mb-2">
          The Reveal!
        </h3>
        <p className="text-swoono-dim text-sm">
          Here's what you both drew for: <span className="text-swoono-accent font-medium">"{game.prompt}"</span>
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My drawing */}
        <DrawingDisplay
          title={`${myPlayer.name}'s Drawing`}
          strokes={myPlayer.drawing.strokes}
          isOwn={true}
        />

        {/* Other player's drawing */}
        <DrawingDisplay
          title={`${otherPlayer.name}'s Drawing`}
          strokes={otherPlayer.drawing.strokes}
          isOwn={false}
        />
      </div>

      <div className="text-center mt-6">
        <p className="text-swoono-dim text-sm">
          The judges are preparing their scorecards...
        </p>
        <div className="flex items-center justify-center mt-2">
          <div className="animate-pulse flex gap-1">
            <div className="w-2 h-2 bg-swoono-accent rounded-full"></div>
            <div className="w-2 h-2 bg-swoono-accent rounded-full animation-delay-200"></div>
            <div className="w-2 h-2 bg-swoono-accent rounded-full animation-delay-400"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawingDisplay({
  title,
  strokes,
  isOwn,
}: {
  title: string;
  strokes: DrawingStroke[];
  isOwn: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear and draw white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes]);

  const downloadDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className={`flex flex-col ${isOwn ? "order-1" : "order-2"}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display text-lg text-swoono-ink">{title}</h4>
        <button
          onClick={downloadDrawing}
          className="text-xs text-swoono-dim hover:text-swoono-accent transition-colors"
        >
          📱 Screenshot
        </button>
      </div>

      <div className="flex-1 bg-white border border-white/20 rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ minHeight: "300px" }}
        />
      </div>

      {strokes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          No drawing submitted
        </div>
      )}
    </div>
  );
}