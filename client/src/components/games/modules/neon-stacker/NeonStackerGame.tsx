import { useEffect, useRef, useState, useCallback } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type { NeonStackerState, NeonStackerMoving } from "../../../../lib/types";

// Classic arcade Stacker. No physics engine — just grid overlap math,
// all run server-side so both clients can never disagree. The only thing
// the client does is draw.

const BLOCK_HEIGHT = 26;
const CRANE_RAIL_Y = 40;
const PLAYER_COLORS = ["#00FFFF", "#FF00FF"] as const;
const PLATFORM_COLOR = "#FFFFFF";

type AudioKind = "drop" | "land" | "levelUp" | "lose";

class StackerAudio {
  ctx: AudioContext | null = null;
  init() {
    if (this.ctx) return;
    const Ctor =
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext || window.AudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
  }
  play(kind: AudioKind) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.connect(g);
    g.connect(this.ctx.destination);
    switch (kind) {
      case "drop":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      case "land":
        osc.type = "sine";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      case "levelUp": {
        osc.type = "square";
        [440, 660, 880].forEach((f, i) => {
          osc.frequency.setValueAtTime(f, now + i * 0.1);
        });
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.42);
        break;
      }
      case "lose":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.6);
        g.gain.setValueAtTime(0.25, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc.start(now);
        osc.stop(now + 0.72);
        break;
    }
  }
}

/** Mirrors the server formula — both clients (and server) agree on X(t). */
function movingX(m: NeonStackerMoving, t: number): number {
  const range = m.maxX - m.minX;
  if (range <= 0) return m.minX;
  const elapsed = Math.max(0, t - m.startedAt) / 1000;
  const traveled = elapsed * m.speed;
  const cycle = range * 2;
  const phase = traveled - Math.floor(traveled / cycle) * cycle;
  return phase <= range ? m.minX + phase : m.maxX - (phase - range);
}

export default function NeonStackerGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const game: NeonStackerState | null =
    activeGame && activeGame.gameId === "neon-stacker" ? activeGame : null;
  const dropBlock = useRoomStore((s) => s.dropNeonStackerBlock);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<StackerAudio>(new StackerAudio());
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 600 });

  // Track previous state for sound-effect triggers.
  const prevStackLenRef = useRef(0);
  const prevLevelRef = useRef(1);
  const prevWinnerRef = useRef<0 | 1 | null>(null);

  const myIdx: 0 | 1 | null = game
    ? game.players[0].clientId === selfClientId
      ? 0
      : game.players[1].clientId === selfClientId
        ? 1
        : null
    : null;
  const myTurn =
    game !== null &&
    myIdx !== null &&
    game.nextPlayerIdx === myIdx &&
    game.winnerIdx === null;

  useEffect(() => {
    const unlock = () => audioRef.current.init();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const resize = () => {
      const parent = containerRef.current;
      if (!parent) return;
      const w = Math.max(320, parent.clientWidth);
      const h = Math.max(420, Math.min(parent.clientHeight, 720));
      setCanvasSize({ w, h });
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Sound effects from state transitions.
  useEffect(() => {
    if (!game) return;
    if (game.stack.length > prevStackLenRef.current) {
      audioRef.current.play("land");
    }
    if (game.level > prevLevelRef.current) {
      audioRef.current.play("levelUp");
    }
    if (prevWinnerRef.current === null && game.winnerIdx !== null) {
      if (game.winnerIdx !== myIdx) audioRef.current.play("lose");
    }
    prevStackLenRef.current = game.stack.length;
    prevLevelRef.current = game.level;
    prevWinnerRef.current = game.winnerIdx;
  }, [game, myIdx]);

  // Award points + effects on game end.
  useEffect(() => {
    if (!game || game.winnerIdx === null || myIdx === null) return;
    if (game.winnerIdx === myIdx) {
      onAwardPoints(20, "Neon Stacker win");
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

  // Canvas render loop — pure draw from authoritative state.
  useEffect(() => {
    if (!game) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;

    let rafId: number | null = null;
    const draw = () => {
      drawStacker(canvas, canvasSize, game);
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [game, canvasSize.w, canvasSize.h]);

  const handleDrop = useCallback(() => {
    if (!game || !myTurn || !game.moving) return;
    const now = Date.now();
    const xLocal = movingX(game.moving, now);
    audioRef.current.play("drop");
    dropBlock(xLocal);
  }, [game, myTurn, dropBlock]);

  // Also support space / enter as drop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleDrop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDrop]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-swoono-dim">
        Starting game…
      </div>
    );
  }

  const opponent = game.players[myIdx === 0 ? 1 : 0];
  const turnLabel =
    game.winnerIdx !== null
      ? game.winnerIdx === myIdx
        ? "You won"
        : "You lost"
      : myTurn
        ? "Your turn"
        : "Opponent's turn";

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">
            Neon Stacker
          </h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {turnLabel}
            {opponent && (
              <>
                {" "}
                · vs{" "}
                <span className="text-swoono-ink">{opponent.name}</span>
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

      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-swoono-dim mb-2">
        <span>
          Level <span className="text-swoono-accent">{game.level}</span>
        </span>
        <span>
          {game.dropsInLevel}/5
        </span>
        <span>
          You{" "}
          <span className="text-swoono-accent">
            {game.playerDropCounts[myIdx ?? 0]}
          </span>{" "}
          · Opp{" "}
          <span className="text-swoono-accent">
            {game.playerDropCounts[myIdx === 0 ? 1 : 0]}
          </span>
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden rounded-lg border border-white/5 bg-black"
        style={{ minHeight: 320, maxHeight: 560 }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            touchAction: "none",
            pointerEvents: "none",
          }}
        />
        {game.banner && (
          <div
            className="absolute inset-x-0 top-1/3 text-center text-2xl font-bold uppercase tracking-widest pointer-events-none"
            style={{
              color: "rgb(var(--swoono-accent))",
              textShadow: "0 0 20px rgb(var(--swoono-accent))",
            }}
          >
            {game.banner}
          </div>
        )}
        {game.winnerIdx !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="text-4xl font-bold uppercase tracking-widest"
              style={{
                color:
                  game.winnerIdx === myIdx
                    ? "rgb(var(--swoono-accent))"
                    : "#FF4444",
                textShadow: "0 0 30px currentColor",
              }}
            >
              {game.winnerIdx === myIdx ? "You win" : "You lose"}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleDrop}
        disabled={!myTurn}
        className="mt-4 w-full py-5 rounded-xl font-bold uppercase tracking-[0.3em] text-lg transition-colors border-2 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: myTurn
            ? "rgb(var(--swoono-accent) / 0.25)"
            : "rgba(255,255,255,0.05)",
          borderColor: myTurn
            ? "rgb(var(--swoono-accent))"
            : "rgba(255,255,255,0.1)",
          color: myTurn ? "#fff" : "rgba(255,255,255,0.4)",
          boxShadow: myTurn
            ? "0 0 30px rgb(var(--swoono-accent) / 0.4)"
            : "none",
        }}
      >
        {game.winnerIdx !== null
          ? game.winnerIdx === myIdx
            ? "You won"
            : "You lost"
          : myTurn
            ? "⬇ DROP ⬇"
            : "Waiting on opponent…"}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────────────────────────

function drawStacker(
  canvas: HTMLCanvasElement,
  size: { w: number; h: number },
  game: NeonStackerState,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size.w, size.h);

  // Subtle grid backdrop.
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < size.w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.h);
    ctx.stroke();
  }
  for (let y = 0; y < size.h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size.w, y);
    ctx.stroke();
  }

  const fieldW = game.fieldWidth;
  const scale = size.w / fieldW;

  // The stack is rendered bottom-up. We want the top-of-stack to stay in
  // view as it grows — compute a camera offset so at most
  // `maxVisibleBlocks` fit on screen before we scroll.
  const totalBlocks = game.stack.length + (game.moving ? 1 : 0);
  const availableHeight = size.h - CRANE_RAIL_Y - 60;
  const maxStackH = Math.max(1, Math.floor(availableHeight / BLOCK_HEIGHT));
  const scrollBlocks = Math.max(0, totalBlocks - maxStackH);
  const cameraY = scrollBlocks * BLOCK_HEIGHT;

  // Platform at the bottom, stack builds upward.
  const baseY = size.h - 40;

  // Draw stack.
  game.stack.forEach((block, i) => {
    const color =
      block.playerIdx === null
        ? PLATFORM_COLOR
        : PLAYER_COLORS[block.playerIdx];
    const yCenter = baseY - i * BLOCK_HEIGHT + cameraY;
    drawNeonBlock(
      ctx,
      block.x * scale,
      yCenter,
      block.width * scale,
      BLOCK_HEIGHT,
      color,
    );
  });

  // Draw moving block + crane rail + hanger.
  if (game.moving && game.winnerIdx === null) {
    const m = game.moving;
    const now = Date.now();
    const cx = movingX(m, now);
    const levelIdx = game.stack.length; // moving sits atop the stack
    const yCenter = baseY - levelIdx * BLOCK_HEIGHT + cameraY;

    // Crane rail.
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, CRANE_RAIL_Y);
    ctx.lineTo(size.w, CRANE_RAIL_Y);
    ctx.stroke();

    const color = PLAYER_COLORS[game.nextPlayerIdx];

    // Hanger line from rail to block top.
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(cx * scale, CRANE_RAIL_Y);
    ctx.lineTo(cx * scale, yCenter - BLOCK_HEIGHT / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Crane "grabber" dot on the rail.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx * scale, CRANE_RAIL_Y, 6, 0, Math.PI * 2);
    ctx.fill();

    drawNeonBlock(
      ctx,
      cx * scale,
      yCenter,
      m.width * scale,
      BLOCK_HEIGHT,
      color,
    );
  }
}

function drawNeonBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  const grad = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
  grad.addColorStop(0, color + "80");
  grad.addColorStop(0.5, color + "40");
  grad.addColorStop(1, color + "80");
  ctx.fillStyle = grad;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.restore();
}
