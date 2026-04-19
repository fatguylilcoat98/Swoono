import { useEffect, useRef, useState, useCallback } from "react";
import { useRoomStore } from "../../../../state/roomStore";
import { triggerEffect } from "../../../../lib/registries/effectRegistry";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";
// Sound functions imported when needed
import type { BattleshipState } from "../../../../lib/types";

// --- Constants ------------------------------------------------------------
const GRID = 10;
const FLEET_DEF: { name: string; len: number }[] = [
  { name: "CARRIER", len: 5 },
  { name: "BATTLESHIP", len: 4 },
  { name: "CRUISER", len: 3 },
  { name: "SUBMARINE", len: 3 },
  { name: "DESTROYER", len: 2 },
];

// --- Local types ---------------------------------------------------------
type LocalShip = {
  name: string;
  len: number;
  x: number;
  y: number;
  vertical: boolean;
  bobPhase: number;
};

type ParticleType = "fire" | "smoke" | "ember" | "shockwave";

type Particle = {
  type: ParticleType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  size: number;
  rotation: number;
  radius: number;
  trail: { x: number; y: number; z: number }[];
};

type AnimState = {
  particles: Particle[];
  shakeX: number;
  shakeY: number;
  time: number;
  radarSweep: number;
  rafId: number | null;
};

// --- Audio (Web Audio + Speech Synthesis) --------------------------------
class AudioSystem {
  ctx: AudioContext | null = null;
  init() {
    if (this.ctx) return;
    const Ctor =
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext || window.AudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
  }
  speak(text: string, rate = 1, pitch = 1) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = pitch;
    u.volume = 0.7;
    window.speechSynthesis.speak(u);
  }
  tone(
    duration: number,
    type: OscillatorType,
    envelope: { time: number; freq: number }[],
  ) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.connect(g);
    g.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    envelope.forEach((p) => o.frequency.setValueAtTime(p.freq, now + p.time));
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + duration);
    o.start(now);
    o.stop(now + duration);
  }
  explosion() {
    this.tone(0.3, "sawtooth", [
      { time: 0, freq: 200 },
      { time: 0.1, freq: 100 },
      { time: 0.3, freq: 50 },
    ]);
    setTimeout(() => this.speak("Direct hit", 1.2, 0.8), 100);
  }
  splash() {
    this.tone(0.4, "sine", [
      { time: 0, freq: 400 },
      { time: 0.05, freq: 200 },
      { time: 0.15, freq: 100 },
      { time: 0.4, freq: 50 },
    ]);
  }
  sunk() {
    this.tone(0.8, "sawtooth", [
      { time: 0, freq: 300 },
      { time: 0.2, freq: 150 },
      { time: 0.5, freq: 80 },
      { time: 0.8, freq: 40 },
    ]);
    setTimeout(() => this.speak("Ship destroyed", 1.1, 0.7), 300);
  }
  yourTurn() {
    this.tone(0.2, "sine", [
      { time: 0, freq: 600 },
      { time: 0.2, freq: 800 },
    ]);
    setTimeout(() => this.speak("Your turn Captain", 1, 1), 100);
  }
  oppTurn() {
    this.tone(0.15, "sine", [
      { time: 0, freq: 400 },
      { time: 0.15, freq: 300 },
    ]);
  }
  ready() {
    this.tone(0.3, "sine", [
      { time: 0, freq: 400 },
      { time: 0.1, freq: 600 },
      { time: 0.3, freq: 800 },
    ]);
    setTimeout(() => this.speak("Fleet ready", 1, 1), 100);
  }
  battleStart() {
    this.tone(0.5, "sine", [
      { time: 0, freq: 300 },
      { time: 0.2, freq: 500 },
      { time: 0.5, freq: 700 },
    ]);
    setTimeout(() => this.speak("Engage", 1.1, 0.9), 200);
  }
  incoming() {
    this.tone(0.3, "sawtooth", [
      { time: 0, freq: 800 },
      { time: 0.1, freq: 600 },
      { time: 0.3, freq: 400 },
    ]);
    setTimeout(() => this.speak("Incoming fire", 1.3, 0.8), 50);
  }
}

// --- Helpers --------------------------------------------------------------
function isValidLocalPlacement(
  ship: LocalShip,
  nx: number,
  ny: number,
  nv: boolean,
  fleet: LocalShip[],
): boolean {
  if (nx < 0 || ny < 0) return false;
  const endX = nv ? nx : nx + ship.len - 1;
  const endY = nv ? ny + ship.len - 1 : ny;
  if (endX >= GRID || endY >= GRID) return false;
  const cells: { x: number; y: number }[] = [];
  for (let i = 0; i < ship.len; i++) {
    cells.push({
      x: nv ? nx : nx + i,
      y: nv ? ny + i : ny,
    });
  }
  for (const other of fleet) {
    if (other === ship) continue;
    for (let i = 0; i < other.len; i++) {
      const ox = other.vertical ? other.x : other.x + i;
      const oy = other.vertical ? other.y + i : other.y;
      for (const c of cells) {
        if (c.x === ox && c.y === oy) return false;
      }
    }
  }
  return true;
}

function cellsOf(ship: {
  x: number;
  y: number;
  len: number;
  vertical: boolean;
}): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let i = 0; i < ship.len; i++) {
    cells.push({
      x: ship.vertical ? ship.x : ship.x + i,
      y: ship.vertical ? ship.y + i : ship.y,
    });
  }
  return cells;
}

function randomFleet(): LocalShip[] {
  const ships: LocalShip[] = FLEET_DEF.map((def) => ({
    name: def.name,
    len: def.len,
    x: 0,
    y: 0,
    vertical: false,
    bobPhase: Math.random() * Math.PI * 2,
  }));
  for (const ship of ships) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = Math.floor(Math.random() * GRID);
      const y = Math.floor(Math.random() * GRID);
      const v = Math.random() > 0.5;
      if (isValidLocalPlacement(ship, x, y, v, ships)) {
        ship.x = x;
        ship.y = y;
        ship.vertical = v;
        break;
      }
    }
  }
  return ships;
}

function lighten(color: string, percent: number): string {
  if (color === "#FFFFFF") return color;
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function darken(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// --- Particle factories ---------------------------------------------------
function mkParticle(type: ParticleType, x: number, y: number): Particle {
  const p: Particle = {
    type,
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 1,
    size: 0,
    rotation: 0,
    radius: 0,
    trail: [],
  };
  if (type === "fire") {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 5 + 3;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.vz = -Math.random() * 8 - 5;
    p.size = Math.random() * 20 + 15;
    p.rotation = Math.random() * Math.PI * 2;
  } else if (type === "smoke") {
    p.vx = (Math.random() - 0.5) * 2;
    p.vy = (Math.random() - 0.5) * 2;
    p.vz = -Math.random() * 3 - 2;
    p.size = Math.random() * 12 + 8;
  } else if (type === "ember") {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 8 + 4;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.vz = -Math.random() * 10 - 6;
    p.size = Math.random() * 5 + 3;
  } else if (type === "shockwave") {
    p.radius = 0;
  }
  return p;
}

function updateParticle(p: Particle) {
  if (p.type === "fire") {
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.vz += 0.4;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= 0.015;
    p.size *= 1.03;
    p.rotation += 0.05;
  } else if (p.type === "smoke") {
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.vz += 0.2;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= 0.015;
    p.size += 0.3;
  } else if (p.type === "ember") {
    p.trail.push({ x: p.x, y: p.y, z: p.z });
    if (p.trail.length > 8) p.trail.shift();
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.vz += 0.5;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= 0.025;
  } else if (p.type === "shockwave") {
    p.radius += 5;
    p.life -= 0.05;
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const sc = Math.max(0.1, 1 / (1 + p.z * 0.01));
  const sx = p.x;
  const sy = p.y - p.z * 0.5;
  const ss = Math.max(1, p.size * sc);
  if (p.type === "fire" && ss > 0) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = p.life * sc;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ss);
    g.addColorStop(0, "rgba(255,255,200,1)");
    g.addColorStop(0.3, "rgba(255,150,0,0.9)");
    g.addColorStop(0.6, "rgba(255,50,0,0.6)");
    g.addColorStop(1, "rgba(100,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const w = Math.sin(a * 3 + p.rotation * 2) * 0.3 + 1;
      const px = Math.cos(a) * ss * w;
      const py = Math.sin(a) * ss * w;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (p.type === "smoke" && ss > 0) {
    ctx.globalAlpha = p.life * 0.5 * sc;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, ss);
    g.addColorStop(0, "rgba(80,80,80,0.7)");
    g.addColorStop(0.5, "rgba(50,50,50,0.4)");
    g.addColorStop(1, "rgba(30,30,30,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, ss, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (p.type === "ember" && ss > 0) {
    ctx.globalAlpha = p.life;
    ctx.strokeStyle = "#FF8800";
    ctx.lineWidth = 3;
    if (p.trail.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        if (i === 0) ctx.moveTo(t.x, t.y - t.z * 0.5);
        else ctx.lineTo(t.x, t.y - t.z * 0.5);
      }
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    ctx.fillStyle = "#FFFF00";
    ctx.beginPath();
    ctx.arc(sx, sy, ss, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (p.type === "shockwave" && p.radius > 0) {
    ctx.globalAlpha = p.life * 0.7;
    ctx.strokeStyle = "#FF6600";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// --- Ship renderer --------------------------------------------------------
function draw3DShip(
  ctx: CanvasRenderingContext2D,
  ship: {
    x: number;
    y: number;
    len: number;
    vertical: boolean;
    hits?: number;
    hitPositions?: { x: number; y: number }[];
    bobPhase?: number;
  },
  cellSize: number,
  color: string,
  time: number,
  opts: { glow?: boolean; sunk?: boolean } = {},
) {
  ctx.save();
  const bob = ship.bobPhase !== undefined ? Math.sin(ship.bobPhase) * 2 : 0;
  const baseX = ship.x * cellSize;
  const baseY = ship.y * cellSize + bob;
  const shipWidth = ship.vertical ? cellSize * 0.65 : ship.len * cellSize - 8;
  const shipHeight = ship.vertical ? ship.len * cellSize - 8 : cellSize * 0.65;
  const x = baseX + (ship.vertical ? cellSize * 0.175 : 4);
  const y = baseY + (ship.vertical ? 4 : cellSize * 0.175);
  const depth = 8;
  const sunk = !!opts.sunk;

  if (opts.glow) {
    const pulse = Math.sin(time * 5) * 0.4 + 0.6;
    ctx.shadowBlur = 40 * pulse;
    ctx.shadowColor = color;
  }

  const deckGradient = ship.vertical
    ? ctx.createLinearGradient(x, y, x + shipWidth, y)
    : ctx.createLinearGradient(x, y, x, y + shipHeight);
  if (sunk) {
    deckGradient.addColorStop(0, "#333");
    deckGradient.addColorStop(0.5, "#555");
    deckGradient.addColorStop(1, "#333");
  } else {
    deckGradient.addColorStop(0, color);
    deckGradient.addColorStop(0.3, lighten(color, 30));
    deckGradient.addColorStop(0.7, color);
    deckGradient.addColorStop(1, darken(color, 20));
  }
  ctx.fillStyle = deckGradient;
  ctx.fillRect(x, y, shipWidth, shipHeight);

  // Right face
  ctx.fillStyle = darken(sunk ? "#333" : color, 30);
  ctx.beginPath();
  ctx.moveTo(x + shipWidth, y);
  ctx.lineTo(x + shipWidth + depth, y + depth);
  ctx.lineTo(x + shipWidth + depth, y + shipHeight + depth);
  ctx.lineTo(x + shipWidth, y + shipHeight);
  ctx.closePath();
  ctx.fill();

  // Bottom face
  ctx.fillStyle = darken(sunk ? "#333" : color, 40);
  ctx.beginPath();
  ctx.moveTo(x, y + shipHeight);
  ctx.lineTo(x + depth, y + shipHeight + depth);
  ctx.lineTo(x + shipWidth + depth, y + shipHeight + depth);
  ctx.lineTo(x + shipWidth, y + shipHeight);
  ctx.closePath();
  ctx.fill();

  if (!sunk) {
    // Segment lines
    ctx.strokeStyle = darken(color, 40);
    ctx.lineWidth = 2;
    for (let i = 1; i < ship.len; i++) {
      if (ship.vertical) {
        const segY = y + i * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, segY);
        ctx.lineTo(x + shipWidth, segY);
        ctx.stroke();
      } else {
        const segX = x + i * cellSize;
        ctx.beginPath();
        ctx.moveTo(segX, y);
        ctx.lineTo(segX, y + shipHeight);
        ctx.stroke();
      }
    }
    // Bridge
    const midIdx = Math.floor(ship.len / 2);
    const bridgeX = ship.vertical
      ? x + shipWidth * 0.25
      : x + midIdx * cellSize + cellSize * 0.25;
    const bridgeY = ship.vertical
      ? y + midIdx * cellSize + cellSize * 0.25
      : y + shipHeight * 0.25;
    const bridgeW = ship.vertical ? shipWidth * 0.5 : cellSize * 0.5;
    const bridgeH = ship.vertical ? cellSize * 0.5 : shipHeight * 0.5;
    ctx.fillStyle = lighten(color, 40);
    ctx.fillRect(bridgeX, bridgeY, bridgeW, bridgeH);
    ctx.fillStyle = "#00FFFF";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#00FFFF";
    for (let i = 0; i < 3; i++) {
      const wx = bridgeX + (bridgeW / 4) * (i + 1) - 3;
      const wy = bridgeY + bridgeH * 0.3;
      ctx.fillRect(wx, wy, 6, 8);
    }
    ctx.shadowBlur = 0;
    // Turrets
    const turretPositions = ship.len === 5 ? [1, 3] : [Math.floor(ship.len / 2)];
    turretPositions.forEach((pos) => {
      const turretX = ship.vertical
        ? x + shipWidth * 0.4
        : x + pos * cellSize + cellSize * 0.4;
      const turretY = ship.vertical
        ? y + pos * cellSize + cellSize * 0.4
        : y + shipHeight * 0.4;
      ctx.fillStyle = darken(color, 20);
      ctx.beginPath();
      ctx.arc(turretX, turretY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = darken(color, 40);
      ctx.fillRect(turretX - 3, turretY - 13, 6, 8);
    });
  }

  // Damage fires
  if (ship.hits && ship.hits > 0 && !sunk && ship.hitPositions) {
    ship.hitPositions.forEach((hit) => {
      const localX = ship.vertical ? 0 : hit.x - ship.x;
      const localY = ship.vertical ? hit.y - ship.y : 0;
      const damageX = ship.vertical
        ? x + shipWidth / 2
        : x + localX * cellSize + cellSize / 2;
      const damageY = ship.vertical
        ? y + localY * cellSize + cellSize / 2
        : y + shipHeight / 2;
      const firePulse = Math.sin(time * 10 + localX + localY) * 0.3 + 0.7;
      const fireRadius = 6 * firePulse;
      if (fireRadius > 0) {
        ctx.fillStyle = "#FF4400";
        ctx.shadowBlur = 15 * firePulse;
        ctx.shadowColor = "#FF4400";
        ctx.beginPath();
        ctx.arc(damageX, damageY, fireRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  if (sunk) {
    ctx.fillStyle = "rgba(255,0,85,0.2)";
    ctx.fillRect(x, y, shipWidth, shipHeight);
    ctx.strokeStyle = "#FF0055";
    ctx.lineWidth = 6;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#FF0055";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + shipWidth, y + shipHeight);
    ctx.moveTo(x + shipWidth, y);
    ctx.lineTo(x, y + shipHeight);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

// --- Main component -------------------------------------------------------
export default function BattleshipGame({
  selfClientId,
  onExit,
  onAwardPoints,
}: GameContextProps) {
  const activeGame = useRoomStore((s) => s.activeGame);
  const game: BattleshipState | null =
    activeGame && activeGame.gameId === "battleship" ? activeGame : null;
  const submitPlacement = useRoomStore((s) => s.submitBattleshipPlacement);
  const fireShot = useRoomStore((s) => s.fireBattleshipShot);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<AnimState>({
    particles: [],
    shakeX: 0,
    shakeY: 0,
    time: 0,
    radarSweep: 0,
    rafId: null,
  });
  const audioRef = useRef<AudioSystem>(new AudioSystem());

  const [localShips, setLocalShips] = useState<LocalShip[]>(() => randomFleet());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [cellSize, setCellSize] = useState(32);
  const [message, setMessage] = useState("POSITION YOUR FLEET");
  const [messageIsDanger, setMessageIsDanger] = useState(false);

  // Track phase transitions for sound + win effects.
  const lastPhaseRef = useRef<string | null>(null);
  const lastOppShotsCountRef = useRef(0);
  const lastMyShotsCountRef = useRef(0);

  const setMsg = useCallback((text: string, danger = false) => {
    setMessage(text);
    setMessageIsDanger(danger);
  }, []);

  // One-time audio unlock on first interaction.
  useEffect(() => {
    const unlock = () => audioRef.current.init();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Size the canvas to the container.
  useEffect(() => {
    const resize = () => {
      const parent = canvasRef.current?.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const max = Math.min(w, h);
      const cs = Math.floor(max / GRID);
      setCellSize(cs);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Resize the canvas whenever cellSize changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = cellSize * GRID;
    canvas.height = cellSize * GRID;
  }, [cellSize]);

  // Animation loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const anim = animRef.current;

    const loop = () => {
      anim.time += 0.016;
      anim.radarSweep = (anim.radarSweep + 0.02) % (Math.PI * 2);
      ctx.save();
      ctx.translate(anim.shakeX, anim.shakeY);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const maxR = Math.max(canvas.width, canvas.height);

      // Bg
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Radar rings
      ctx.strokeStyle = "rgba(57,255,20,0.15)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const r = (maxR / 5) * i;
        if (r > 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Radar sweep
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(anim.radarSweep);
      const sg = ctx.createLinearGradient(0, 0, maxR, 0);
      sg.addColorStop(0, "rgba(57,255,20,0.3)");
      sg.addColorStop(0.5, "rgba(57,255,20,0.1)");
      sg.addColorStop(1, "rgba(57,255,20,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxR, -0.3, 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Grid
      ctx.strokeStyle = "rgba(57,255,20,0.25)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 3;
      ctx.shadowColor = "rgba(57,255,20,0.4)";
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Phase-dependent rendering
      if (!game || game.phase === "placement") {
        // Placement: show local ships
        localShips.forEach((ship, idx) => {
          ship.bobPhase += 0.03;
          const isSel = idx === selectedIdx;
          draw3DShip(
            ctx,
            ship,
            cellSize,
            isSel ? "#FFFFFF" : "#39FF14",
            anim.time,
            { glow: isSel },
          );
        });
      } else {
        // Battle/done: show targeting grid (my shots at opponent)
        //
        // Layer 1: ghost overlay of YOUR OWN fleet — translucent so the
        // player can always see where their ships are. Answers Chris's
        // "I can't see where my ships are" complaint.
        if (game.myShips && game.myShips.length > 0) {
          ctx.save();
          ctx.globalAlpha = 0.22;
          game.myShips.forEach((ship) => {
            draw3DShip(
              ctx,
              {
                x: ship.x,
                y: ship.y,
                len: ship.len,
                vertical: ship.vertical,
                hits: ship.hits,
                hitPositions: ship.hitPositions,
                bobPhase: (ship.x + ship.y) * 0.3,
              },
              cellSize,
              "#00BFFF",
              anim.time,
              { glow: false },
            );
          });
          ctx.restore();
        }

        // Build a map of the opponent's hit cells → which sunk ship
        // that cell belongs to (if any). Cells in a sunk ship render as
        // a dark burned-out hulk; cells in a still-floating ship render
        // as a ship-segment silhouette with fire particles on top.
        const sunkShipNames = new Set(
          game.myShotsFired
            .filter((s) => s.sunkShipName)
            .map((s) => s.sunkShipName as string),
        );

        // Group my hit shots by the presumed ship they hit (inferred
        // via adjacency). Simple heuristic: a run of adjacent hit cells
        // is one ship. Good enough for visual effect.
        const hitCells = game.myShotsFired.filter((s) => s.hit);

        // Layer 2: draw every hit shot with real ship-segment visuals.
        hitCells.forEach((shot) => {
          const scx = shot.x * cellSize + cellSize / 2;
          const scy = shot.y * cellSize + cellSize / 2;
          const isSunkHit =
            !!shot.sunkShipName && sunkShipNames.has(shot.sunkShipName);

          if (isSunkHit) {
            // Dark burned-out hulk
            ctx.save();
            ctx.fillStyle = "#331111";
            ctx.strokeStyle = "#FF0055";
            ctx.lineWidth = 2;
            ctx.shadowBlur = 14;
            ctx.shadowColor = "#FF0055";
            const inset = cellSize * 0.12;
            ctx.fillRect(
              shot.x * cellSize + inset,
              shot.y * cellSize + inset,
              cellSize - inset * 2,
              cellSize - inset * 2,
            );
            ctx.strokeRect(
              shot.x * cellSize + inset,
              shot.y * cellSize + inset,
              cellSize - inset * 2,
              cellSize - inset * 2,
            );
            // Red cross on the dead segment
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "#FF4477";
            ctx.lineWidth = 3;
            const d = cellSize * 0.22;
            ctx.beginPath();
            ctx.moveTo(scx - d, scy - d);
            ctx.lineTo(scx + d, scy + d);
            ctx.moveTo(scx + d, scy - d);
            ctx.lineTo(scx - d, scy + d);
            ctx.stroke();
            ctx.restore();
          } else {
            // Still-floating ship segment being hit — reveal the
            // segment shape and render fire + smoke on it
            ctx.save();
            ctx.fillStyle = "rgba(100,100,100,0.55)";
            ctx.strokeStyle = "#FF8844";
            ctx.lineWidth = 2;
            ctx.shadowBlur = 18;
            ctx.shadowColor = "#FF6622";
            const inset = cellSize * 0.14;
            ctx.fillRect(
              shot.x * cellSize + inset,
              shot.y * cellSize + inset,
              cellSize - inset * 2,
              cellSize - inset * 2,
            );
            ctx.strokeRect(
              shot.x * cellSize + inset,
              shot.y * cellSize + inset,
              cellSize - inset * 2,
              cellSize - inset * 2,
            );

            // Fire animation — flicker
            const fireFlicker =
              Math.sin(anim.time * 11 + shot.x * 2 + shot.y * 3) * 0.3 +
              0.7;
            const fireRadius = cellSize * 0.18 * fireFlicker;
            const fireGrad = ctx.createRadialGradient(
              scx,
              scy,
              0,
              scx,
              scy,
              fireRadius,
            );
            fireGrad.addColorStop(0, "rgba(255,255,180,0.95)");
            fireGrad.addColorStop(0.4, "rgba(255,140,0,0.85)");
            fireGrad.addColorStop(0.8, "rgba(255,40,0,0.5)");
            fireGrad.addColorStop(1, "rgba(100,0,0,0)");
            ctx.fillStyle = fireGrad;
            ctx.beginPath();
            ctx.arc(scx, scy, fireRadius, 0, Math.PI * 2);
            ctx.fill();

            // Persistent gentle smoke particles rising off the segment
            if (Math.random() < 0.015) {
              anim.particles.push(mkParticle(
                "smoke",
                scx + (Math.random() - 0.5) * cellSize * 0.4,
                scy + (Math.random() - 0.5) * cellSize * 0.2,
              ));
            }
            ctx.restore();
          }
        });

        // Layer 3: misses (water ripples) — smaller so they don't
        // compete visually with hits
        game.myShotsFired.forEach((shot) => {
          if (shot.hit) return;
          const scx = shot.x * cellSize + cellSize / 2;
          const scy = shot.y * cellSize + cellSize / 2;
          const ripple = Math.sin(anim.time * 3) * 0.2 + 0.8;
          ctx.strokeStyle = `rgba(100,200,255,${0.45 * ripple})`;
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 6;
          ctx.shadowColor = "rgba(100,200,255,0.5)";
          for (let r = 1; r <= 2; r++) {
            const rad = 4 * r * ripple;
            if (rad > 0) {
              ctx.beginPath();
              ctx.arc(scx, scy, rad, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          ctx.shadowBlur = 0;
        });
      }

      // Particles
      anim.particles = anim.particles.filter((p) => {
        updateParticle(p);
        if (p.life > 0) {
          drawParticle(ctx, p);
          return true;
        }
        return false;
      });

      ctx.restore();
      anim.rafId = requestAnimationFrame(loop);
    };

    anim.rafId = requestAnimationFrame(loop);
    return () => {
      if (anim.rafId !== null) cancelAnimationFrame(anim.rafId);
    };
  }, [cellSize, game, localShips, selectedIdx]);

  // React to phase transitions and opponent shots.
  useEffect(() => {
    if (!game) return;
    const phase = game.phase;

    // First battle entry
    if (lastPhaseRef.current !== phase) {
      if (phase === "battle" && lastPhaseRef.current === "placement") {
        audioRef.current.battleStart();
        setTimeout(() => {
          if (game.turnIdx === game.myIdx) {
            audioRef.current.yourTurn();
            setMsg("YOUR TURN — SELECT TARGET");
          } else {
            audioRef.current.oppTurn();
            setMsg("OPPONENT'S TURN");
          }
        }, 1500);
      } else if (phase === "done") {
        const iWon = game.winnerIdx === game.myIdx;
        if (iWon) {
          audioRef.current.tone(1, "sine", [
            { time: 0, freq: 400 },
            { time: 0.3, freq: 600 },
            { time: 0.6, freq: 800 },
            { time: 1, freq: 1000 },
          ]);
          setTimeout(
            () => audioRef.current.speak("Victory", 1, 1.1),
            300,
          );
          onAwardPoints(25, "Neon Fleet win");
          triggerEffect({
            effectId: "effect.game.win",
            fromClientId: selfClientId,
          });
          setMsg("VICTORY");
        } else {
          audioRef.current.tone(1.2, "sawtooth", [
            { time: 0, freq: 400 },
            { time: 0.4, freq: 250 },
            { time: 0.8, freq: 150 },
            { time: 1.2, freq: 80 },
          ]);
          setTimeout(
            () => audioRef.current.speak("Mission failed", 0.9, 0.7),
            400,
          );
          triggerEffect({
            effectId: "effect.game.lose",
            fromClientId: selfClientId,
          });
          setMsg("DEFEAT", true);
        }
      }
      lastPhaseRef.current = phase;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.winnerIdx]);

  // React to new shots (incoming + outgoing).
  useEffect(() => {
    if (!game) return;
    const anim = animRef.current;

    // Incoming shots (opponent fired at me)
    if (game.opponentShotsFired.length > lastOppShotsCountRef.current) {
      const newShots = game.opponentShotsFired.slice(
        lastOppShotsCountRef.current,
      );
      newShots.forEach((shot) => {
        if (shot.hit) {
          audioRef.current.incoming();
          setTimeout(() => audioRef.current.explosion(), 300);
          // Screen shake
          const start = Date.now();
          const shake = () => {
            const elapsed = Date.now() - start;
            if (elapsed < 400) {
              const amt = 15 * (1 - elapsed / 400);
              anim.shakeX = (Math.random() - 0.5) * amt;
              anim.shakeY = (Math.random() - 0.5) * amt;
              requestAnimationFrame(shake);
            } else {
              anim.shakeX = 0;
              anim.shakeY = 0;
            }
          };
          shake();
          if (shot.sunkShipName) {
            setTimeout(() => audioRef.current.sunk(), 500);
            setMsg(`YOUR ${shot.sunkShipName} DESTROYED`, true);
          } else {
            setMsg("YOU'VE BEEN HIT", true);
          }
        } else {
          audioRef.current.splash();
          setMsg("OPPONENT MISSED");
        }
      });
      lastOppShotsCountRef.current = game.opponentShotsFired.length;
    }

    // My shot results
    if (game.myShotsFired.length > lastMyShotsCountRef.current) {
      const newShots = game.myShotsFired.slice(lastMyShotsCountRef.current);
      newShots.forEach((shot) => {
        if (shot.hit) {
          audioRef.current.explosion();
          // Fire explosion particles on the targeting grid
          const x = shot.x * cellSize + cellSize / 2;
          const y = shot.y * cellSize + cellSize / 2;
          anim.particles.push(mkParticle("shockwave", x, y));
          for (let i = 0; i < 30; i++) {
            anim.particles.push(
              mkParticle(
                "fire",
                x + (Math.random() - 0.5) * 20,
                y + (Math.random() - 0.5) * 20,
              ),
            );
          }
          for (let i = 0; i < 20; i++) {
            anim.particles.push(
              mkParticle(
                "ember",
                x + (Math.random() - 0.5) * 30,
                y + (Math.random() - 0.5) * 30,
              ),
            );
          }
          if (shot.sunkShipName) {
            setTimeout(() => audioRef.current.sunk(), 300);
            setMsg(`ENEMY ${shot.sunkShipName} SUNK`, true);
          } else {
            setMsg("HIT");
          }
        } else {
          audioRef.current.splash();
          setMsg("MISS");
        }
      });
      lastMyShotsCountRef.current = game.myShotsFired.length;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.myShotsFired, game?.opponentShotsFired]);

  // Turn change messaging (battle phase)
  useEffect(() => {
    if (!game || game.phase !== "battle") return;
    if (game.turnIdx === game.myIdx) {
      setMsg("YOUR TURN — SELECT TARGET");
    } else {
      setMsg("OPPONENT'S TURN");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.turnIdx, game?.phase]);

  // Click/tap handler
  const handleClick = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const gx = Math.floor(((e.clientX - rect.left) / rect.width) * GRID);
      const gy = Math.floor(((e.clientY - rect.top) / rect.height) * GRID);
      if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) return;

      if (!game || game.phase === "placement") {
        // Placement handling
        if (selectedIdx !== null) {
          const ship = localShips[selectedIdx];
          if (
            isValidLocalPlacement(ship, gx, gy, ship.vertical, localShips)
          ) {
            const next = [...localShips];
            next[selectedIdx] = { ...ship, x: gx, y: gy };
            setLocalShips(next);
            setMsg(`${ship.name} POSITIONED`);
            setSelectedIdx(null);
          } else {
            setMsg("INVALID POSITION", true);
          }
        } else {
          const idx = localShips.findIndex((ship) =>
            cellsOf(ship).some((c) => c.x === gx && c.y === gy),
          );
          if (idx >= 0) {
            setSelectedIdx(idx);
            setMsg(`${localShips[idx].name} SELECTED — TAP NEW POSITION`);
          }
        }
      } else if (game.phase === "battle") {
        if (game.turnIdx !== game.myIdx) {
          setMsg("WAIT FOR YOUR TURN", true);
          return;
        }
        if (game.myShotsFired.some((s) => s.x === gx && s.y === gy)) return;
        fireShot(gx, gy);
        setMsg("SHOT FIRED");
      }
    },
    [game, selectedIdx, localShips, fireShot, setMsg],
  );

  const rotate = () => {
    if (selectedIdx === null) return;
    const ship = localShips[selectedIdx];
    if (
      isValidLocalPlacement(ship, ship.x, ship.y, !ship.vertical, localShips)
    ) {
      const next = [...localShips];
      next[selectedIdx] = { ...ship, vertical: !ship.vertical };
      setLocalShips(next);
      setMsg("SHIP ROTATED");
    } else {
      setMsg("CANNOT ROTATE HERE", true);
    }
  };

  const randomize = () => {
    setLocalShips(randomFleet());
    setSelectedIdx(null);
    setMsg("FLEET REPOSITIONED");
  };

  const submitReady = () => {
    audioRef.current.ready();
    submitPlacement(
      localShips.map((s) => ({
        name: s.name,
        len: s.len,
        x: s.x,
        y: s.y,
        vertical: s.vertical,
      })),
    );
    setMsg("WAITING FOR OPPONENT…");
  };

  const phase = game?.phase ?? "placement";
  const myReady = game?.myReady ?? false;
  const shipsLeft = game
    ? game.myShips.filter((s) => s.hits < s.len).length
    : FLEET_DEF.length;
  const oppShotsHit = game
    ? game.myShotsFired.filter((s) => s.hit).length
    : 0;
  // Crude "opponent ships remaining" estimate: FLEET_DEF.length minus distinct sunk names.
  const oppSunk = game
    ? new Set(
        game.myShotsFired
          .filter((s) => s.sunkShipName)
          .map((s) => s.sunkShipName as string),
      ).size
    : 0;
  const oppLeft = FLEET_DEF.length - oppSunk;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-swoono-ink">Neon Fleet</h2>
          <p className="text-swoono-dim text-xs uppercase tracking-widest mt-1">
            {phase === "placement"
              ? myReady
                ? "Awaiting opponent"
                : "Position your fleet"
              : phase === "battle"
                ? game?.turnIdx === game?.myIdx
                  ? "Your turn"
                  : "Opponent's turn"
                : game?.winnerIdx === game?.myIdx
                  ? "Victory"
                  : "Defeat"}
            {game && (
              <>
                {" "}
                · vs{" "}
                <span className="text-swoono-ink">{game.opponentName}</span>
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
          You: <span className="text-swoono-accent">{shipsLeft}/5</span>
        </span>
        <span>
          Hits: <span className="text-swoono-accent">{oppShotsHit}</span>
        </span>
        <span>
          Opp: <span className="text-swoono-accent">{oppLeft}/5</span>
        </span>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        style={{ minHeight: 280 }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handleClick}
          style={{
            touchAction: "none",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        />
      </div>

      <p
        className="text-center text-xs uppercase tracking-widest mt-3 min-h-[18px]"
        style={{ color: messageIsDanger ? "#FF0055" : "rgb(var(--swoono-accent))" }}
      >
        {message}
      </p>

      {phase === "placement" && !myReady && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={rotate}
            disabled={selectedIdx === null}
            className="flex-1 py-3 px-3 border border-white/10 text-xs uppercase tracking-widest text-swoono-ink hover:border-swoono-accent/40 disabled:opacity-40"
          >
            ↻ Rotate
          </button>
          <button
            onClick={randomize}
            className="flex-1 py-3 px-3 border border-white/10 text-xs uppercase tracking-widest text-swoono-ink hover:border-swoono-accent/40"
          >
            ⚡ Randomize
          </button>
          <button
            onClick={submitReady}
            className="flex-1 py-3 px-3 bg-swoono-accent text-black text-xs uppercase tracking-widest font-semibold"
          >
            ✓ Ready
          </button>
        </div>
      )}
    </div>
  );
}
