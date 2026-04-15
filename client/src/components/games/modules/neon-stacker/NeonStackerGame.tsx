import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
import type {
  NeonStackerState,
  NeonStackerDrop,
  NeonStackerShape,
} from "../../../../lib/types";

// Port of Chris's Neon Stacker HTML game. Physics tuned down from the
// original — Chris's complaint was "the gravity is way too harsh, blocks
// whirl off the screen". Fix:
//   - gravity.y = 0.6 (half the real-world default; original was 1.2)
//   - NO random angular velocity on drop (that's the "whirl" bug)
//   - restitution = 0 (no bounce at all)
//   - 8 shape variants for variety (original had 3)
//   - 5 blocks per level (original was 4)

const GRAVITY_Y = 0.6;
// Blocks per level is enforced server-side (5) — see server/src/index.ts.
const MAX_PLATFORM_WIDTH = 350;
const PLATFORM_SHRINK_PER_LEVEL = 20;
const MIN_PLATFORM_WIDTH = 80;
const PLATFORM_HEIGHT = 25;
const CRANE_Y = 35;
const SPAWN_Y = 120;

const PLAYER_COLORS = ["#00FFFF", "#FF00FF"] as const;

// 8 block shapes — wide, tall, and small variants. Randomized per drop.
const SHAPES: NeonStackerShape[] = [
  { name: "tiny",     width: 50,  height: 50 },
  { name: "square",   width: 70,  height: 70 },
  { name: "chonk",    width: 90,  height: 90 },
  { name: "wide",     width: 120, height: 45 },
  { name: "wide-big", width: 140, height: 55 },
  { name: "chunk",    width: 100, height: 60 },
  { name: "tall",     width: 45,  height: 120 },
  { name: "narrow",   width: 55,  height: 100 },
];

// ──────────────────────────────────────────────────────────────────
// Audio
// ──────────────────────────────────────────────────────────────────

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
  private tone(
    duration: number,
    type: OscillatorType,
    freqs: { t: number; f: number }[],
    gain = 0.15,
  ) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.connect(g);
    g.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    freqs.forEach((f) => osc.frequency.setValueAtTime(f.f, now + f.t));
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }
  whoosh() {
    this.tone(
      0.2,
      "sawtooth",
      [{ t: 0, f: 200 }, { t: 0.2, f: 1000 }],
    );
  }
  thud(mass = 1) {
    const base = Math.max(25, 70 - mass * 15);
    this.tone(
      0.35,
      "sine",
      [{ t: 0, f: base * 2 }, { t: 0.15, f: base }],
      0.3,
    );
  }
  ding() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    [880, 1108.73, 1318.51].forEach((f, i) => {
      this.tone(0.4, "sine", [{ t: i * 0.04, f }], 0.1);
    });
  }
  levelUp() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    [220, 330, 440, 660, 880].forEach((f, i) => {
      this.tone(0.3, "square", [{ t: i * 0.08, f }], 0.12);
    });
  }
  crash() {
    this.tone(
      0.8,
      "sawtooth",
      [{ t: 0, f: 200 }, { t: 0.4, f: 50 }, { t: 0.8, f: 20 }],
      0.25,
    );
  }
}

// ──────────────────────────────────────────────────────────────────
// Particles (simplified from the original for the embedded size)
// ──────────────────────────────────────────────────────────────────

type StackerParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
  kind: "spark" | "ring";
  radius: number;
  maxRadius: number;
};

function mkSpark(x: number, y: number, color: string): StackerParticle {
  const a = Math.random() * Math.PI * 2;
  const s = 3 + Math.random() * 8;
  return {
    x,
    y,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s - 2,
    life: 1,
    size: 3 + Math.random() * 4,
    color,
    kind: "spark",
    radius: 0,
    maxRadius: 0,
  };
}

function mkRing(x: number, y: number, color: string): StackerParticle {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    life: 1,
    size: 0,
    color,
    kind: "ring",
    radius: 8,
    maxRadius: 80,
  };
}

function updateParticle(p: StackerParticle) {
  if (p.kind === "ring") {
    p.radius += (p.maxRadius - p.radius) * 0.12;
    p.life -= 0.035;
    return;
  }
  p.x += p.vx;
  p.y += p.vy;
  p.vy += 0.4;
  p.vx *= 0.97;
  p.life -= 0.02;
  p.size *= 0.97;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: StackerParticle) {
  ctx.save();
  ctx.globalAlpha = p.life;
  ctx.shadowBlur = 18;
  ctx.shadowColor = p.color;
  if (p.kind === "ring") {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3 * p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────

type StackerBlock = Matter.Body & {
  color?: string;
  blockWidth?: number;
  blockHeight?: number;
  hasLanded?: boolean;
  playerIdx?: 0 | 1;
};

type EngineState = {
  engine: Matter.Engine;
  world: Matter.World;
  platform: Matter.Body;
  currentBlock: StackerBlock | null;
  landedBlocks: StackerBlock[];
  platformWidth: number;
  cameraY: number;
  targetCameraY: number;
  craneTime: number;
  craneX: number;
  isDropping: boolean;
  waitingForStable: boolean;
  stableCheckTimer: number;
  shakeAmount: number;
  shakeX: number;
  shakeY: number;
  particles: StackerParticle[];
  lastProcessedDropIndex: number;
  currentLevel: number;
  gameOverReported: boolean;
  rafId: number | null;
  time: number;
  onGameOver: (() => void) | null;
};

export default function NeonStackerGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const game: NeonStackerState | null =
    activeGame && activeGame.gameId === "neon-stacker" ? activeGame : null;
  const dropBlock = useRoomStore((s) => s.dropNeonStackerBlock);
  const reportGameOver = useRoomStore((s) => s.reportNeonStackerGameOver);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineStateRef = useRef<EngineState | null>(null);
  const audioRef = useRef<StackerAudio>(new StackerAudio());
  const [message, setMessage] = useState("");
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 600 });

  const myIdx: 0 | 1 | null = game
    ? game.players[0].clientId === selfClientId
      ? 0
      : game.players[1].clientId === selfClientId
        ? 1
        : null
    : null;
  const myTurn = game && myIdx !== null && game.nextPlayerIdx === myIdx;

  // Unlock audio on first interaction
  useEffect(() => {
    const unlock = () => audioRef.current.init();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Size the canvas to its container
  useEffect(() => {
    const resize = () => {
      const parent = containerRef.current;
      if (!parent) return;
      const w = Math.max(320, parent.clientWidth);
      // Prefer a tall canvas since stacking is vertical
      const h = Math.max(480, Math.min(parent.clientHeight, 720));
      setCanvasSize({ w, h });
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Initialize the physics engine once the canvas is sized
  useEffect(() => {
    if (!game) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;

    // Tear down any prior engine
    if (engineStateRef.current) {
      const prev = engineStateRef.current;
      if (prev.rafId !== null) cancelAnimationFrame(prev.rafId);
      Matter.Engine.clear(prev.engine);
    }

    const engine = Matter.Engine.create();
    engine.world.gravity.y = GRAVITY_Y;

    const platformWidth = Math.min(
      MAX_PLATFORM_WIDTH,
      canvasSize.w * 0.8,
    );
    const platform = Matter.Bodies.rectangle(
      canvasSize.w / 2,
      canvasSize.h - 60,
      platformWidth,
      PLATFORM_HEIGHT,
      { isStatic: true, label: "platform", chamfer: { radius: 3 } },
    );
    Matter.World.add(engine.world, platform);

    const state: EngineState = {
      engine,
      world: engine.world,
      platform,
      currentBlock: null,
      landedBlocks: [],
      platformWidth,
      cameraY: 0,
      targetCameraY: 0,
      craneTime: 0,
      craneX: canvasSize.w / 2,
      isDropping: false,
      waitingForStable: false,
      stableCheckTimer: 0,
      shakeAmount: 0,
      shakeX: 0,
      shakeY: 0,
      particles: [],
      lastProcessedDropIndex: 0,
      currentLevel: 1,
      gameOverReported: false,
      rafId: null,
      time: 0,
      onGameOver: () => reportGameOver(),
    };
    engineStateRef.current = state;

    // Spawn first block. Shape is picked locally for display; the
    // authoritative shape for drops is the one in lastDrop from the
    // server broadcast.
    spawnBlock(state, nextShape(), game.nextPlayerIdx);

    // Collision listener — drives landing detection + particles
    Matter.Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const block = state.currentBlock;
        if (!block || block.hasLanded) return;
        if (pair.bodyA !== block && pair.bodyB !== block) return;
        const other = pair.bodyA === block ? pair.bodyB : pair.bodyA;
        if (other.label !== "platform" && other.label !== "block") return;

        block.hasLanded = true;
        const v = block.velocity;
        const speed = Math.sqrt(v.x * v.x + v.y * v.y);
        audioRef.current.thud(block.mass * 800);
        state.shakeAmount = Math.min(22, speed * block.mass * 500);
        const cx = block.position.x;
        const cy = block.position.y + state.cameraY;
        for (let i = 0; i < 22; i++) {
          state.particles.push(mkSpark(cx, cy, block.color || "#FFF"));
        }
        state.particles.push(mkRing(cx, cy, block.color || "#FFF"));
        state.waitingForStable = true;
        state.stableCheckTimer = 0;
      });
    });

    const loop = () => {
      updateEngine(state, canvasSize);
      drawEngine(state, canvas, canvasSize);
      state.rafId = requestAnimationFrame(loop);
    };
    state.rafId = requestAnimationFrame(loop);

    return () => {
      if (state.rafId !== null) cancelAnimationFrame(state.rafId);
      Matter.Events.off(engine, "collisionStart");
      Matter.Engine.clear(engine);
    };
    // We intentionally re-init when canvasSize or game existence changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.w, canvasSize.h, game?.startedAt]);

  // Replay authoritative drops as they come in from the server
  useEffect(() => {
    if (!game || !game.lastDrop) return;
    const state = engineStateRef.current;
    if (!state) return;
    if (game.lastDrop.index <= state.lastProcessedDropIndex) return;

    // Apply the drop: sync crane + spawn + drop
    const drop = game.lastDrop;
    state.lastProcessedDropIndex = drop.index;
    applyDrop(state, drop, audioRef.current);
  }, [game?.lastDrop?.index]);

  // Level-up detection (cosmetic — authoritative state is on server)
  useEffect(() => {
    if (!game) return;
    const state = engineStateRef.current;
    if (!state) return;
    if (game.level > state.currentLevel) {
      state.currentLevel = game.level;
      audioRef.current.levelUp();
      state.shakeAmount = 18;
      // Visual ring at the platform
      const cx = canvasSize.w / 2;
      const cy = canvasSize.h - 60 + state.cameraY;
      state.particles.push(mkRing(cx, cy, "#FFFF00"));
      for (let i = 0; i < 30; i++) {
        state.particles.push(mkSpark(cx, cy, "#FFFF00"));
      }
      // Resize the platform
      Matter.World.remove(state.world, state.platform);
      const newWidth = Math.max(
        MIN_PLATFORM_WIDTH,
        Math.min(MAX_PLATFORM_WIDTH, canvasSize.w * 0.8) -
          (game.level - 1) * PLATFORM_SHRINK_PER_LEVEL,
      );
      const newPlatform = Matter.Bodies.rectangle(
        canvasSize.w / 2,
        canvasSize.h - 60,
        newWidth,
        PLATFORM_HEIGHT,
        { isStatic: true, label: "platform", chamfer: { radius: 3 } },
      );
      Matter.World.add(state.world, newPlatform);
      state.platform = newPlatform;
      state.platformWidth = newWidth;
      setMessage(`LEVEL ${game.level}`);
      window.setTimeout(() => setMessage(""), 1500);
    }
  }, [game?.level, canvasSize.w, canvasSize.h]);

  // React to game over from the server
  useEffect(() => {
    if (!game || game.winnerIdx === null) return;
    audioRef.current.crash();
    const iWon = game.winnerIdx === myIdx;
    if (iWon) {
      onAwardPoints(20, "Neon Stacker win");
      triggerEffect({
        effectId: "effect.game.win",
        fromClientId: selfClientId,
      });
      setMessage("YOU WIN");
    } else {
      triggerEffect({
        effectId: "effect.game.lose",
        fromClientId: selfClientId,
      });
      setMessage("TOWER COLLAPSED");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.winnerIdx]);

  // Click / tap to drop
  const handleTap = useCallback(() => {
    const state = engineStateRef.current;
    if (!state || !game || game.winnerIdx !== null) return;
    if (state.isDropping || state.waitingForStable) return;
    if (!myTurn) {
      setMessage("OPPONENT'S TURN");
      window.setTimeout(() => setMessage(""), 800);
      return;
    }
    const block = state.currentBlock;
    if (!block) return;
    const shape: NeonStackerShape = {
      width: block.blockWidth || 70,
      height: block.blockHeight || 70,
      name: "pending",
    };
    dropBlock(state.craneX, state.craneTime, shape);
  }, [game, myTurn, dropBlock]);

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
          You{" "}
          <span className="text-swoono-accent">
            {game.playerDropCounts[myIdx ?? 0]}
          </span>{" "}
          · Opp{" "}
          <span className="text-swoono-accent">
            {game.playerDropCounts[myIdx === 0 ? 1 : 0]}
          </span>
        </span>
        <span>
          Drops <span className="text-swoono-accent">{game.dropCount}</span>
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden rounded-lg border border-white/5 bg-black"
        style={{ minHeight: 480 }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handleTap}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            touchAction: "none",
          }}
        />
        {message && (
          <div
            className="absolute inset-x-0 top-4 text-center text-xs uppercase tracking-widest pointer-events-none"
            style={{ color: "rgb(var(--swoono-accent))" }}
          >
            {message}
          </div>
        )}
      </div>

      <p className="text-center text-[10px] uppercase tracking-widest text-swoono-dim mt-3">
        ⬇ Tap to drop
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Physics helpers (outside the component for clarity)
// ──────────────────────────────────────────────────────────────────

function nextShape(): NeonStackerShape {
  return SHAPES[Math.floor(Math.random() * SHAPES.length)];
}

function spawnBlock(
  state: EngineState,
  shape: NeonStackerShape,
  playerIdx: 0 | 1,
) {
  const color = PLAYER_COLORS[playerIdx];
  const block = Matter.Bodies.rectangle(
    state.craneX,
    SPAWN_Y - state.cameraY,
    shape.width,
    shape.height,
    {
      label: "block",
      restitution: 0, // no bounce at all — the "harsh gravity" fix
      friction: 0.9,
      frictionStatic: 1.2,
      density: 0.001 * (shape.width * shape.height / 3600),
      chamfer: { radius: 2 },
    },
  ) as StackerBlock;
  block.color = color;
  block.blockWidth = shape.width;
  block.blockHeight = shape.height;
  block.hasLanded = false;
  block.playerIdx = playerIdx;
  Matter.Body.setStatic(block, true);
  Matter.World.add(state.world, block);
  state.currentBlock = block;
}

function applyDrop(
  state: EngineState,
  drop: NeonStackerDrop,
  audio: StackerAudio,
) {
  // Sync the crane to the authoritative position
  state.craneTime = drop.craneTime;
  state.craneX = drop.craneX;
  // If the block we have matches this player, we still want to
  // replace it with the authoritative shape to keep clients in sync.
  if (state.currentBlock) {
    Matter.World.remove(state.world, state.currentBlock);
    state.currentBlock = null;
  }
  spawnBlock(state, drop.shape, drop.playerIdx);
  // Position at the crane
  if (state.currentBlock) {
    Matter.Body.setPosition(state.currentBlock, {
      x: state.craneX,
      y: SPAWN_Y - state.cameraY,
    });
    audio.whoosh();
    Matter.Body.setStatic(state.currentBlock, false);
    // NO angular velocity — this is the "whirl off the screen" fix.
  }
  state.isDropping = true;
}

function updateEngine(
  state: EngineState,
  canvasSize: { w: number; h: number },
) {
  state.time += 1 / 60;
  Matter.Engine.update(state.engine, 1000 / 60);

  // Crane motion
  if (!state.isDropping && !state.waitingForStable && state.currentBlock) {
    state.craneTime += 0.025;
    const range = canvasSize.w * 0.38;
    state.craneX = canvasSize.w / 2 + Math.sin(state.craneTime) * range;
    Matter.Body.setPosition(state.currentBlock, {
      x: state.craneX,
      y: SPAWN_Y - state.cameraY,
    });
  }

  // Stability check → landed
  if (state.waitingForStable) {
    state.stableCheckTimer++;
    const stable = checkStability(state);
    if (state.stableCheckTimer > 50 && (stable || state.stableCheckTimer > 150)) {
      if (state.currentBlock) {
        state.landedBlocks.push(state.currentBlock);
        state.currentBlock = null;
      }
      state.isDropping = false;
      state.waitingForStable = false;
      // Spawn the next block for the NEXT player (server will flip
      // nextPlayerIdx after processing this drop on its side).
    }
  }

  // Camera
  let highest = canvasSize.h - 60 - PLATFORM_HEIGHT / 2;
  state.landedBlocks.forEach((b) => {
    const top = b.position.y - (b.blockHeight || 70) / 2;
    if (top < highest) highest = top;
  });
  const margin = 220;
  if (highest < margin - state.cameraY) {
    state.targetCameraY = margin - highest;
  }
  state.cameraY += (state.targetCameraY - state.cameraY) * 0.08;

  // Screen shake
  if (state.shakeAmount > 0) {
    state.shakeX = (Math.random() - 0.5) * state.shakeAmount;
    state.shakeY = (Math.random() - 0.5) * state.shakeAmount;
    state.shakeAmount *= 0.85;
    if (state.shakeAmount < 0.3) state.shakeAmount = 0;
  } else {
    state.shakeX = 0;
    state.shakeY = 0;
  }

  // Particles
  state.particles = state.particles.filter((p) => {
    updateParticle(p);
    return p.life > 0;
  });

  // Game over detection — the current block fell off the world
  if (!state.gameOverReported && state.currentBlock) {
    const bb = state.currentBlock.position.y + 60;
    const pb = state.platform.position.y + 15;
    if (bb > pb + 200) {
      state.gameOverReported = true;
      state.onGameOver?.();
    }
  }
  // Also check all landed blocks for falling off
  if (!state.gameOverReported) {
    for (const b of state.landedBlocks) {
      if (b.position.y > canvasSize.h + 300 - state.cameraY) {
        state.gameOverReported = true;
        state.onGameOver?.();
        break;
      }
    }
  }
}

function checkStability(state: EngineState): boolean {
  let motion = 0;
  state.landedBlocks.forEach((b) => {
    motion += Math.abs(b.velocity.x) + Math.abs(b.velocity.y);
    motion += Math.abs(b.angularVelocity) * 10;
  });
  if (state.currentBlock) {
    motion +=
      Math.abs(state.currentBlock.velocity.x) +
      Math.abs(state.currentBlock.velocity.y);
    motion += Math.abs(state.currentBlock.angularVelocity) * 10;
  }
  return motion < 0.4;
}

function drawEngine(
  state: EngineState,
  canvas: HTMLCanvasElement,
  size: { w: number; h: number },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.translate(state.shakeX, state.shakeY);

  // Background
  ctx.fillStyle = "#000";
  ctx.fillRect(-30, -30, size.w + 60, size.h + 60);

  // Subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  const gridSize = 50;
  const offsetY = (state.cameraY * 0.5) % gridSize;
  for (let x = 0; x < size.w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.h);
    ctx.stroke();
  }
  for (let y = offsetY; y < size.h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size.w, y);
    ctx.stroke();
  }

  // Crane rail
  if (!state.isDropping && !state.waitingForStable) {
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, CRANE_Y);
    ctx.lineTo(size.w, CRANE_Y);
    ctx.stroke();
  }

  // Platform
  const platX = state.platform.position.x;
  const platY = state.platform.position.y + state.cameraY;
  const platW = state.platformWidth;
  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = "#FFF";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(platX - platW / 2, platY - PLATFORM_HEIGHT / 2, platW, PLATFORM_HEIGHT);
  ctx.strokeStyle = "#FFF";
  ctx.lineWidth = 2;
  ctx.strokeRect(platX - platW / 2, platY - PLATFORM_HEIGHT / 2, platW, PLATFORM_HEIGHT);
  ctx.restore();

  // Landed blocks
  state.landedBlocks.forEach((block) => drawBlock(ctx, block, state.cameraY));

  // Current block
  if (state.currentBlock) {
    drawBlock(ctx, state.currentBlock, state.cameraY);
    // Crane hanger line
    if (!state.isDropping) {
      const color = state.currentBlock.color || "#FFF";
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(state.craneX, CRANE_Y);
      ctx.lineTo(
        state.craneX,
        state.currentBlock.position.y +
          state.cameraY -
          (state.currentBlock.blockHeight || 70) / 2,
      );
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(state.craneX, CRANE_Y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Particles
  state.particles.forEach((p) => drawParticle(ctx, p));

  ctx.restore();
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: StackerBlock,
  cameraY: number,
) {
  const w = block.blockWidth || 70;
  const h = block.blockHeight || 70;
  const color = block.color || "#FFF";
  const x = block.position.x;
  const y = block.position.y + cameraY;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(block.angle);
  ctx.shadowBlur = 25;
  ctx.shadowColor = color;
  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grad.addColorStop(0, color + "70");
  grad.addColorStop(0.5, color + "40");
  grad.addColorStop(1, color + "70");
  ctx.fillStyle = grad;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}
