#!/usr/bin/env node
/**
 * Unit tests for Neon Stacker game logic (no server, no sockets).
 *
 * The old implementation desynced because matter.js physics was
 * replayed on each client and the two replays diverged. The new
 * implementation is pure math + server-broadcast state. This test
 * verifies that math is:
 *   1. Deterministic — same inputs always produce same outputs
 *   2. Correct — perfect drops keep width, partial drops shrink,
 *      misses lose
 *   3. Stable across the full level flow (5 drops → level up)
 *
 * Run: node scripts/test-neon-stacker-logic.mjs
 */

// ── Mirrors the server / client formulas (intentionally duplicated so
// this test doesn't depend on the TS transpile pipeline) ──────────────

function movingX(m, t) {
  const range = m.maxX - m.minX;
  if (range <= 0) return m.minX;
  const elapsed = Math.max(0, t - m.startedAt) / 1000;
  const traveled = elapsed * m.speed;
  const cycle = range * 2;
  const phase = traveled - Math.floor(traveled / cycle) * cycle;
  return phase <= range ? m.minX + phase : m.maxX - (phase - range);
}

const NS_BASE_BLOCK_WIDTH = 120;
const NS_MIN_BLOCK_WIDTH = 40;
const NS_LEVEL_WIDTH_SHRINK = 10;
const NS_BASE_SPEED = 220;
const NS_SPEED_PER_LEVEL = 35;
const NS_MAX_SPEED = 520;
const NS_FIELD_WIDTH = 600;
const NS_BASE_PLATFORM_WIDTH = 150;
const NS_DROPS_PER_LEVEL = 5;

function blockWidthForLevel(level) {
  return Math.max(
    NS_MIN_BLOCK_WIDTH,
    NS_BASE_BLOCK_WIDTH - (level - 1) * NS_LEVEL_WIDTH_SHRINK,
  );
}

function speedForLevel(level) {
  return Math.min(NS_MAX_SPEED, NS_BASE_SPEED + (level - 1) * NS_SPEED_PER_LEVEL);
}

function makeMoving(width, level, startedAt) {
  const half = width / 2;
  return {
    width,
    minX: half,
    maxX: NS_FIELD_WIDTH - half,
    speed: speedForLevel(level),
    startedAt,
  };
}

function applyDrop(state, myIdx, reportedX) {
  if (state.winnerIdx !== null) return { ok: false, reason: "game over" };
  if (state.nextPlayerIdx !== myIdx) return { ok: false, reason: "wrong turn" };
  if (!state.moving) return { ok: false, reason: "no moving block" };

  const dropX = Math.min(
    state.moving.maxX,
    Math.max(state.moving.minX, reportedX),
  );
  const dropWidth = state.moving.width;
  const newLeft = dropX - dropWidth / 2;
  const newRight = dropX + dropWidth / 2;

  const top = state.stack[state.stack.length - 1];
  const topLeft = top.x - top.width / 2;
  const topRight = top.x + top.width / 2;
  const overlapLeft = Math.max(newLeft, topLeft);
  const overlapRight = Math.min(newRight, topRight);
  const overlap = overlapRight - overlapLeft;

  state.playerDropCounts[myIdx] += 1;

  if (overlap <= 0) {
    state.winnerIdx = myIdx === 0 ? 1 : 0;
    state.moving = null;
    state.banner = "TOWER COLLAPSED";
    return { ok: true, miss: true };
  }

  state.stack.push({
    x: (overlapLeft + overlapRight) / 2,
    width: overlap,
    playerIdx: myIdx,
  });
  state.dropsInLevel += 1;

  let nextWidth = overlap;
  let banner = null;
  if (state.dropsInLevel >= NS_DROPS_PER_LEVEL) {
    state.level += 1;
    state.dropsInLevel = 0;
    banner = `LEVEL ${state.level - 1} COMPLETE`;
    nextWidth = blockWidthForLevel(state.level);
  }
  state.nextPlayerIdx = myIdx === 0 ? 1 : 0;
  state.moving = makeMoving(nextWidth, state.level, state.moving.startedAt + 1000);
  state.banner = banner;
  return { ok: true, miss: false, overlap };
}

function newGame(startedAt) {
  return {
    stack: [{ x: NS_FIELD_WIDTH / 2, width: NS_BASE_PLATFORM_WIDTH, playerIdx: null }],
    moving: makeMoving(blockWidthForLevel(1), 1, startedAt),
    nextPlayerIdx: 0,
    dropsInLevel: 0,
    level: 1,
    playerDropCounts: [0, 0],
    winnerIdx: null,
    banner: null,
  };
}

// ── Assertion harness ─────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed += 1;
  }
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "not equal"}: expected ${b}, got ${a}`);
}

function approx(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error(
    `${msg || "not approx"}: expected ${b} ± ${tol}, got ${a}`,
  );
}

// ── 1. Determinism ────────────────────────────────────────────────────

console.log("\n[1] X(t) determinism");
test("same inputs produce same outputs", () => {
  const m = makeMoving(120, 1, 10_000);
  for (let i = 0; i < 100; i++) {
    const t = 10_000 + i * 37.3;
    const a = movingX(m, t);
    const b = movingX(m, t);
    eq(a, b, `t=${t}`);
  }
});

test("two independent sessions with same moving state give same X", () => {
  // Simulates the two clients computing X(t) from the broadcast state.
  const mA = makeMoving(120, 1, 1700000000000);
  const mB = { ...mA };
  for (let t = mA.startedAt; t < mA.startedAt + 5000; t += 13) {
    eq(movingX(mA, t), movingX(mB, t), `t=${t}`);
  }
});

test("X stays within [minX, maxX]", () => {
  const m = makeMoving(120, 1, 0);
  for (let t = 0; t < 20000; t += 7.5) {
    const x = movingX(m, t);
    if (x < m.minX - 1e-9 || x > m.maxX + 1e-9) {
      throw new Error(`x=${x} out of [${m.minX}, ${m.maxX}] at t=${t}`);
    }
  }
});

test("X sweeps end-to-end and back", () => {
  const m = makeMoving(120, 1, 0);
  // Period = 2 * range / speed seconds.
  const range = m.maxX - m.minX;
  const half = (range / m.speed) * 1000; // ms to traverse one way
  approx(movingX(m, 0), m.minX, 1e-6, "start");
  approx(movingX(m, half), m.maxX, 1e-6, "mid");
  approx(movingX(m, 2 * half), m.minX, 1e-6, "back");
});

// ── 2. Overlap math ───────────────────────────────────────────────────

console.log("\n[2] Overlap math");
test("perfect drop keeps full width", () => {
  const g = newGame(0);
  const platformX = g.stack[0].x;
  const r = applyDrop(g, 0, platformX);
  eq(r.ok, true);
  eq(r.miss, false);
  eq(g.stack.length, 2);
  eq(g.stack[1].width, 120, "new block width");
  eq(g.stack[1].x, platformX, "new block x");
});

test("partial clip shrinks to overlap", () => {
  const g = newGame(0);
  const platformX = g.stack[0].x; // 300, width 150 → [225, 375]
  // Drop at x=330: new block [270, 390]. Overlap [270, 375] = 105.
  const r = applyDrop(g, 0, 330);
  eq(r.ok, true);
  eq(r.miss, false);
  eq(g.stack[1].width, 105, "overlap width");
  approx(g.stack[1].x, (270 + 375) / 2, 1e-9, "overlap center");
});

test("complete miss ends game, other player wins", () => {
  const g = newGame(0);
  // Moving block width 120, minX=60, maxX=540. Drop reportedX=60
  // → block spans [0, 120]. Platform [225, 375]. Overlap: 0 − 225 < 0.
  const r = applyDrop(g, 0, 60);
  eq(r.ok, true);
  eq(r.miss, true);
  eq(g.winnerIdx, 1, "p1 should win");
  eq(g.moving, null);
});

test("drop off the right edge also misses", () => {
  const g = newGame(0);
  // Drop at x=540 → block spans [480, 600]. Platform [225, 375]. Miss.
  const r = applyDrop(g, 0, 540);
  eq(r.miss, true);
  eq(g.winnerIdx, 1);
});

test("wrong turn rejected", () => {
  const g = newGame(0);
  const r = applyDrop(g, 1, 300);
  eq(r.ok, false);
  eq(g.stack.length, 1, "stack unchanged");
});

test("drops after game over rejected", () => {
  const g = newGame(0);
  applyDrop(g, 0, 60); // miss → game over
  const r = applyDrop(g, 1, 300);
  eq(r.ok, false);
});

// ── 3. Level flow ─────────────────────────────────────────────────────

console.log("\n[3] Level-up flow");
test("5 perfect drops trigger level up with fresh block", () => {
  const g = newGame(0);
  const platformX = g.stack[0].x;
  for (let i = 0; i < 5; i++) {
    const who = i % 2 === 0 ? 0 : 1;
    const r = applyDrop(g, who, platformX);
    eq(r.ok, true, `drop ${i + 1} ok`);
    eq(r.miss, false, `drop ${i + 1} not a miss`);
  }
  eq(g.level, 2, "level advanced");
  eq(g.dropsInLevel, 0, "dropsInLevel reset");
  eq(g.stack.length, 6, "platform + 5 blocks");
  eq(g.banner, "LEVEL 1 COMPLETE", "banner set");
  eq(g.moving.width, blockWidthForLevel(2), "fresh block width for level 2");
  if (g.moving.speed <= speedForLevel(1)) {
    throw new Error("speed should increase at level 2");
  }
});

test("turns alternate correctly across level boundary", () => {
  const g = newGame(0);
  const platformX = g.stack[0].x;
  const seq = [];
  for (let i = 0; i < 7; i++) {
    seq.push(g.nextPlayerIdx);
    applyDrop(g, g.nextPlayerIdx, platformX);
  }
  // Expected alternation: 0,1,0,1,0, then next level starts with whoever
  // was not the last dropper → 1,0
  eq(seq[0], 0);
  eq(seq[1], 1);
  eq(seq[2], 0);
  eq(seq[3], 1);
  eq(seq[4], 0);
  eq(seq[5], 1); // post-level-up, p0 dropped last in level 1, so p1 now
  eq(seq[6], 0);
});

test("player drop counts tracked per player", () => {
  const g = newGame(0);
  const platformX = g.stack[0].x;
  for (let i = 0; i < 5; i++) {
    applyDrop(g, g.nextPlayerIdx, platformX);
  }
  eq(g.playerDropCounts[0], 3, "p0 did drops 1,3,5");
  eq(g.playerDropCounts[1], 2, "p1 did drops 2,4");
});

test("successive clips never grow block width", () => {
  const g = newGame(0);
  let lastWidth = g.moving.width;
  // Alternate small offsets to induce shrink
  const offsets = [10, -8, 6, -5, 4];
  for (let i = 0; i < offsets.length; i++) {
    const who = g.nextPlayerIdx;
    const topX = g.stack[g.stack.length - 1].x;
    applyDrop(g, who, topX + offsets[i]);
    if (g.winnerIdx !== null) break;
    if (g.moving && g.dropsInLevel > 0) {
      if (g.moving.width > lastWidth + 1e-9) {
        throw new Error(`width grew: ${lastWidth} → ${g.moving.width}`);
      }
      lastWidth = g.moving.width;
    }
  }
});

// ── 4. Cross-client state consistency ────────────────────────────────

console.log("\n[4] Cross-client consistency");
test("two independent state copies stay in lockstep when fed same drops", () => {
  // Simulates both clients applying the same server broadcast.
  const a = newGame(0);
  const b = newGame(0);
  const drops = [300, 305, 295, 310, 290, 298, 306];
  for (const x of drops) {
    const who = a.nextPlayerIdx;
    applyDrop(a, who, x);
    applyDrop(b, who, x);
    eq(a.stack.length, b.stack.length, "stack length");
    for (let i = 0; i < a.stack.length; i++) {
      eq(a.stack[i].x, b.stack[i].x, `stack[${i}].x`);
      eq(a.stack[i].width, b.stack[i].width, `stack[${i}].width`);
      eq(a.stack[i].playerIdx, b.stack[i].playerIdx, `stack[${i}].playerIdx`);
    }
    eq(a.level, b.level, "level");
    eq(a.dropsInLevel, b.dropsInLevel, "dropsInLevel");
    eq(a.nextPlayerIdx, b.nextPlayerIdx, "nextPlayerIdx");
    eq(a.winnerIdx, b.winnerIdx, "winnerIdx");
    if (a.winnerIdx !== null) break;
  }
});

// ── Report ────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
