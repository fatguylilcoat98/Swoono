import { useRef, useEffect, useState, useCallback } from "react";
import type { DrawingStroke } from "../../../../lib/types";

interface DrawingCanvasProps {
  strokes: DrawingStroke[];
  onStrokeComplete: (stroke: DrawingStroke) => void;
  disabled?: boolean;
}

const COLORS = ["#000000", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"];
const STROKE_WIDTHS = [2, 4, 8, 12];

export default function DrawingCanvas({
  strokes,
  onStrokeComplete,
  disabled = false,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedWidth, setSelectedWidth] = useState(STROKE_WIDTHS[1]);

  // Redraw all strokes whenever strokes array changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Redraw all strokes
    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke);
    });

    // Draw current stroke if in progress
    if (currentStroke) {
      drawStroke(ctx, currentStroke);
    }
  }, [strokes, currentStroke]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
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
  };

  const getEventPos = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.type.startsWith("touch")) {
      const touch = (e as TouchEvent).touches[0] || (e as TouchEvent).changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    if (disabled) return;

    e.preventDefault();
    const pos = getEventPos(e);

    const newStroke: DrawingStroke = {
      id: `stroke-${Date.now()}-${Math.random()}`,
      points: [pos],
      color: selectedColor,
      width: selectedWidth,
      timestamp: Date.now(),
    };

    setCurrentStroke(newStroke);
    setIsDrawing(true);
  }, [disabled, getEventPos, selectedColor, selectedWidth]);

  const continueDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing || !currentStroke || disabled) return;

    e.preventDefault();
    const pos = getEventPos(e);

    setCurrentStroke(prev =>
      prev ? { ...prev, points: [...prev.points, pos] } : null
    );
  }, [isDrawing, currentStroke, disabled, getEventPos]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || !currentStroke) return;

    setIsDrawing(false);

    // Only submit if stroke has at least 2 points
    if (currentStroke.points.length >= 2) {
      onStrokeComplete(currentStroke);
    }

    setCurrentStroke(null);
  }, [isDrawing, currentStroke, onStrokeComplete]);

  // Mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => startDrawing(e);
    const handleMouseMove = (e: MouseEvent) => continueDrawing(e);
    const handleMouseUp = () => stopDrawing();

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [startDrawing, continueDrawing, stopDrawing]);

  // Touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => startDrawing(e);
    const handleTouchMove = (e: TouchEvent) => continueDrawing(e);
    const handleTouchEnd = () => stopDrawing();

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [startDrawing, continueDrawing, stopDrawing]);

  const clearCanvas = () => {
    // This would require server support to clear all strokes
    // For now, just clear locally (not persistent)
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Drawing controls */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {/* Color picker */}
        <div className="flex gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                selectedColor === color
                  ? "border-swoono-accent scale-110"
                  : "border-white/20 hover:border-white/40"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Brush size */}
        <div className="flex gap-2">
          {STROKE_WIDTHS.map((width) => (
            <button
              key={width}
              onClick={() => setSelectedWidth(width)}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedWidth === width
                  ? "border-swoono-accent bg-swoono-accent/20"
                  : "border-white/20 hover:border-white/40 bg-white/5"
              }`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: width, height: width }}
              />
            </button>
          ))}
        </div>

        {/* Clear button */}
        <button
          onClick={clearCanvas}
          disabled={disabled || strokes.length === 0}
          className="px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className={`w-full h-full border border-white/10 rounded-lg bg-white ${
            disabled ? "cursor-not-allowed opacity-75" : "cursor-crosshair"
          }`}
          style={{ touchAction: "none" }}
        />
        {disabled && (
          <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-medium">Time's up!</span>
          </div>
        )}
      </div>
    </div>
  );
}