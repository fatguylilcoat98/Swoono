#!/usr/bin/env node
/**
 * Headless 2-player game test harness for Swoono.
 *
 * Spins up two socket.io clients, joins them to the same room, walks
 * through each game's happy path, and asserts end-state. No browser,
 * no manual clicking — runs in ~30 seconds and prints pass/fail for
 * every game.
 *
 * Usage:
 *   # Assume server is running locally on :3001
 *   node scripts/test-games.mjs
 *
 *   # Or point at a different URL
 *   SWOONO_URL=https://swoono.onrender.com node scripts/test-games.mjs
 *
 * Exit code 0 if all pass, 1 if any fail.
 */

import { io } from "socket.io-client";

const SERVER_URL = process.env.SWOONO_URL || "http://localhost:3001";
const TIMEOUT_MS = 15000;

// Fresh per-run so tests don't collide with each other
function fresh(id) {
  return `TEST-${id}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

function mkClient(name) {
  const clientId = `test-${name}-${Math.random().toString(36).slice(2, 8)}`;
  const sock = io(SERVER_URL, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
  });
  sock.__clientId = clientId;
  sock.__name = name;
  sock.__lastGame = null;
  sock.on("game:update", ({ game }) => {
    sock.__lastGame = game;
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`connect timeout: ${name}`)),
      5000,
    );
    sock.on("connect", () => {
      clearTimeout(timer);
      resolve(sock);
    });
    sock.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(new Error(`connect_error ${name}: ${err.message}`));
    });
  });
}

function joinRoom(sock, code) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`join timeout: ${sock.__name}`)),
      5000,
    );
    sock.emit(
      "join",
      { code, name: sock.__name, clientId: sock.__clientId },
      (res) => {
        clearTimeout(timer);
        if (res?.ok) resolve(res);
        else reject(new Error(`join failed for ${sock.__name}: ${res?.error}`));
      },
    );
  });
}

// Wait for a predicate to become true on any "game:update" event
function waitForGameState(sock, predicate, { timeoutMs = TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    // Fast path: predicate may already match the last-seen state, because
    // the server may have emitted game:update between our last await and
    // this call.
    try {
      if (sock.__lastGame !== null && predicate(sock.__lastGame)) {
        resolve(sock.__lastGame);
        return;
      }
    } catch (err) {
      reject(err);
      return;
    }
    const timer = setTimeout(() => {
      sock.off("game:update", handler);
      reject(
        new Error(
          `waitForGameState timeout (${timeoutMs}ms) on ${sock.__name}`,
        ),
      );
    }, timeoutMs);
    const handler = ({ game }) => {
      try {
        if (predicate(game)) {
          clearTimeout(timer);
          sock.off("game:update", handler);
          resolve(game);
        }
      } catch (err) {
        clearTimeout(timer);
        sock.off("game:update", handler);
        reject(err);
      }
    };
    sock.on("game:update", handler);
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

// ══════════════════════════════════════════════════════════════════
// TEST CASES
// ══════════════════════════════════════════════════════════════════

async function testTicTacToe(p1, p2) {
  // Both players join, p1 starts the game
  p1.emit("game:start", { gameId: "tic-tac-toe" });
  const started = await Promise.all([
    waitForGameState(p1, (g) => g?.gameId === "tic-tac-toe"),
    waitForGameState(p2, (g) => g?.gameId === "tic-tac-toe"),
  ]);
  assert(started[0].players.X.clientId === p1.__clientId, "p1 should be X");

  // p1 wins: X on 0, O on 3, X on 1, O on 4, X on 2 (top row)
  const moves = [
    { sock: p1, cell: 0 },
    { sock: p2, cell: 3 },
    { sock: p1, cell: 1 },
    { sock: p2, cell: 4 },
    { sock: p1, cell: 2 }, // winning move
  ];
  for (const m of moves) {
    m.sock.emit("game:move", { cellIndex: m.cell });
    await new Promise((r) => setTimeout(r, 80));
  }
  const final = await waitForGameState(p1, (g) => g?.winner !== null);
  assert(final.winner === "X", `expected winner X, got ${final.winner}`);
  p1.emit("game:exit");
  await new Promise((r) => setTimeout(r, 200));
}

async function testConnectFour(p1, p2) {
  p1.emit("game:start", { gameId: "connect-four" });
  const started = await Promise.all([
    waitForGameState(p1, (g) => g?.gameId === "connect-four"),
    waitForGameState(p2, (g) => g?.gameId === "connect-four"),
  ]);
  // Red is p1. p1 drops 4 in column 0; p2 drops in column 1 alternating.
  const cols = [0, 1, 0, 1, 0, 1, 0];
  for (let i = 0; i < cols.length; i++) {
    const sock = i % 2 === 0 ? p1 : p2;
    sock.emit("game:move", { column: cols[i] });
    await new Promise((r) => setTimeout(r, 80));
  }
  const final = await waitForGameState(p1, (g) => g?.winner !== null);
  assert(final.winner === "red", `expected winner red, got ${final.winner}`);
  p1.emit("game:exit");
  await new Promise((r) => setTimeout(r, 200));
}

async function testHangman(p1, p2) {
  p1.emit("game:start", { gameId: "hangman" });
  const started = await waitForGameState(
    p1,
    (g) => g?.gameId === "hangman" && g.word,
  );
  const word = started.word;
  const letters = [...new Set(word.split(""))];
  // Alternate guesses between the two players — correct letters only
  for (let i = 0; i < letters.length; i++) {
    const sock = i % 2 === 0 ? p1 : p2;
    sock.emit("game:move", { letter: letters[i] });
    await new Promise((r) => setTimeout(r, 80));
  }
  const final = await waitForGameState(p1, (g) => g?.winner !== null);
  assert(final.winner === "win", `expected win, got ${final.winner}`);
  p1.emit("game:exit");
  await new Promise((r) => setTimeout(r, 200));
}

async function testWordChain(p1, p2) {
  p1.emit("game:start", { gameId: "word-chain" });
  const started = await waitForGameState(
    p1,
    (g) => g?.gameId === "word-chain" && g.nextLetter,
  );
  // Bank of words to fall back to per letter
  const FALLBACK = {
    A: "apple",
    B: "banana",
    C: "cat",
    D: "dog",
    E: "echo",
    F: "fish",
    G: "goat",
    H: "hat",
    I: "ice",
    J: "jump",
    K: "key",
    L: "lamp",
    M: "moon",
    N: "nest",
    O: "ocean",
    P: "pen",
    R: "rain",
    S: "sun",
    T: "tree",
    U: "umbrella",
    V: "van",
    W: "water",
  };
  let current = started;
  for (let turn = 0; turn < 4; turn++) {
    const sock = turn % 2 === 0 ? p1 : p2;
    const letter = current.nextLetter;
    let word = FALLBACK[letter];
    if (!word) {
      word = `${letter.toLowerCase()}ana`;
    }
    // Avoid repeats by appending turn index in a way that still starts
    // with the letter (since the word-chain server dedupes by string)
    if (current.history.some((h) => h.word === word)) {
      word = `${word}${turn}`;
    }
    sock.emit("game:move", { action: "submitWord", word });
    current = await waitForGameState(
      sock,
      (g) => g?.history?.length > turn,
    );
  }
  assert(current.history.length >= 4, "should have 4+ words");
  // End by forfeiting as p2 on p2's next turn (if it's their turn)
  const forfeiter = current.turnIdx === 0 ? p1 : p2;
  forfeiter.emit("game:move", { action: "forfeit" });
  const final = await waitForGameState(p1, (g) => g?.winnerIdx !== null);
  assert(final.winnerIdx !== null, "should have a winner after forfeit");
  p1.emit("game:exit");
  await new Promise((r) => setTimeout(r, 200));
}

async function testTrivia(p1, p2) {
  p1.emit("game:start", { gameId: "trivia" });
  const started = await waitForGameState(
    p1,
    (g) => g?.gameId === "trivia" && g.questions?.length === 10,
  );
  let current = started;
  while (current.winner === null) {
    const question = current.questions[current.currentIdx];
    if (!question) break;
    const correct = question.correctIdx;
    // p1 always answers correctly, p2 picks a wrong index quickly after
    p1.emit("game:move", { action: "answer", choice: correct });
    await new Promise((r) => setTimeout(r, 50));
    const wrong = (correct + 1) % 4;
    p2.emit("game:move", { action: "answer", choice: wrong });
    current = await waitForGameState(
      p1,
      (g) => g?.currentIdx > current.currentIdx || g?.winner !== null,
    );
  }
  assert(current.winner !== null, "trivia should complete");
  assert(
    current.winnerIdx === 0 || current.winner === "draw",
    `expected p1 to win, got winnerIdx=${current.winnerIdx}`,
  );
  p1.emit("game:exit");
  await new Promise((r) => setTimeout(r, 200));
}

async function testCouplesTrivia(p1, p2) {
  p1.emit("game:start", { gameId: "love-trivia" });
  const started = await waitForGameState(
    p1,
    (g) => g?.gameId === "love-trivia" && g.phase === "setup",
  );
  assert(started.questions.length === 10, "10 questions");
  // Phase 1: both players submit all 10 setup predictions
  for (let i = 0; i < 10; i++) {
    p1.emit("game:move", { action: "setupPredict", qIdx: i, choice: 0 });
    p2.emit("game:move", { action: "setupPredict", qIdx: i, choice: 1 });
    await new Promise((r) => setTimeout(r, 40));
  }
  // Wait for phase transition
  const gamePhase = await waitForGameState(
    p1,
    (g) => g?.phase === "game" || g?.phase === "done",
  );
  assert(
    gamePhase.phase === "game" || gamePhase.phase === "done",
    "should advance to game phase",
  );
  // Phase 2: both answer — p1 answers 0, p2 answers 1 for each
  let current = gamePhase;
  while (current.winner === null && current.phase === "game") {
    p1.emit("game:move", { action: "answer", choice: 0 });
    p2.emit("game:move", { action: "answer", choice: 1 });
    current = await waitForGameState(
      p1,
      (g) =>
        g?.currentIdx > current.currentIdx ||
        g?.winner !== null ||
        g?.phase === "done",
    );
  }
  assert(
    current.winner === "done",
    `expected done, got ${current.winner}`,
  );
  // Because p1 always predicted 0 and p2 always answered 1, p1's
  // predictions should all match p2's actual answers NO — wait.
  // Actually: p1 predicted 0 for what p2 would answer. p2 answered 1.
  // So p1's predictions miss. p2 predicted 1, p1 answered 0 → miss.
  // Scores should both be 0.
  assert(current.scores[0] === 0, "p1 shouldn't score (all misses)");
  assert(current.scores[1] === 0, "p2 shouldn't score (all misses)");
  p1.emit("game:exit");
  await new Promise((r) => setTimeout(r, 200));
}

async function testLovingQuest(p1, p2) {
  p1.emit("game:start", { gameId: "loving-quest" });
  const started = await waitForGameState(
    p1,
    (g) => g?.gameId === "loving-quest" && g.prompts.length === 6,
  );
  let current = started;
  while (current.winner === null) {
    p1.emit("game:move", { action: "markDone" });
    p2.emit("game:move", { action: "markDone" });
    current = await waitForGameState(
      p1,
      (g) => g?.currentIdx > current.currentIdx || g?.winner !== null,
    );
  }
  assert(current.winner === "done", "quest should complete");
  p1.emit("game:exit");
  await new Promise((r) => setTimeout(r, 200));
}

async function testTruthOrDare(p1, p2) {
  p1.emit("game:start", { gameId: "truth-or-dare" });
  const started = await waitForGameState(
    p1,
    (g) => g?.gameId === "truth-or-dare",
  );
  let current = started;
  while (current.winner === null) {
    const turnSock = current.turnIdx === 0 ? p1 : p2;
    turnSock.emit("game:move", { action: "pickPrompt", promptType: "truth" });
    current = await waitForGameState(
      turnSock,
      (g) => g?.currentPrompt !== null || g?.winner !== null,
    );
    if (current.winner !== null) break;
    turnSock.emit("game:move", { action: "completePrompt" });
    current = await waitForGameState(
      turnSock,
      (g) => g?.currentPrompt === null || g?.winner !== null,
    );
  }
  assert(current.winner === "win", "truth-or-dare should complete");
  assert(
    current.roundsCompleted === current.totalRounds,
    `expected all rounds completed`,
  );
  p1.emit("game:exit");
  await new Promise((r) => setTimeout(r, 200));
}

async function testNeonStacker(p1, p2) {
  p1.emit("game:start", { gameId: "neon-stacker" });
  const started = await waitForGameState(
    p1,
    (g) => g?.gameId === "neon-stacker",
  );
  assert(started.nextPlayerIdx === 0, "first turn should be p0");
  // Do 3 drops, alternating
  let current = started;
  const shape = { width: 70, height: 70, name: "square" };
  for (let i = 0; i < 3; i++) {
    const turnSock = current.nextPlayerIdx === 0 ? p1 : p2;
    const prevDropCount = current.dropCount;
    turnSock.emit("game:move", {
      action: "drop",
      craneX: 200,
      craneTime: i * 0.5,
      shape,
    });
    current = await waitForGameState(
      p1,
      (g) => g?.dropCount > prevDropCount,
    );
  }
  assert(current.dropCount === 3, `expected dropCount=3, got ${current.dropCount}`);
  // Verify nextPlayerIdx alternates correctly — after 3 drops starting
  // from idx 0, the next player should be idx 1
  assert(
    current.nextPlayerIdx === 1,
    `expected nextPlayerIdx=1 after 3 drops, got ${current.nextPlayerIdx}`,
  );
  // Report game-over from whoever dropped last
  p1.emit("game:move", { action: "reportGameOver" });
  const final = await waitForGameState(p1, (g) => g?.winnerIdx !== null);
  assert(final.winnerIdx !== null, "should have a winner after gameOver");
  p1.emit("game:exit");
  await new Promise((r) => setTimeout(r, 200));
}

// ══════════════════════════════════════════════════════════════════
// RUNNER
// ══════════════════════════════════════════════════════════════════

const TESTS = [
  ["TicTacToe", testTicTacToe],
  ["ConnectFour", testConnectFour],
  ["Hangman", testHangman],
  ["WordChain", testWordChain],
  ["Trivia", testTrivia],
  ["CouplesTrivia", testCouplesTrivia],
  ["LovingQuest", testLovingQuest],
  ["TruthOrDare", testTruthOrDare],
  ["NeonStacker", testNeonStacker],
];

async function runOne(name, fn) {
  const code = fresh(name.slice(0, 3).toUpperCase());
  const p1 = await mkClient("p1");
  const p2 = await mkClient("p2");
  try {
    await joinRoom(p1, code);
    await joinRoom(p2, code);
    // Small settle
    await new Promise((r) => setTimeout(r, 200));
    await fn(p1, p2);
    return { name, ok: true };
  } catch (err) {
    return { name, ok: false, error: err.message };
  } finally {
    // Wipe the test room so it doesn't leave debris
    try {
      p1.emit("room:reset", {
        code,
        clientId: p1.__clientId,
        force: true,
      });
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      /* ignore */
    }
    p1.disconnect();
    p2.disconnect();
  }
}

async function main() {
  log(`▶ Target: ${SERVER_URL}`);
  const results = [];
  for (const [name, fn] of TESTS) {
    log(`  ▸ ${name}…`);
    const start = Date.now();
    const res = await runOne(name, fn);
    const ms = Date.now() - start;
    if (res.ok) log(`    ✓ ${name} (${ms}ms)`);
    else log(`    ✗ ${name} — ${res.error}`);
    results.push({ ...res, ms });
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  log("");
  log(`── SUMMARY ──`);
  log(`  Passed: ${passed}/${results.length}`);
  log(`  Failed: ${failed}/${results.length}`);
  if (failed > 0) {
    log("");
    log("Failures:");
    for (const r of results) {
      if (!r.ok) log(`  ${r.name}: ${r.error}`);
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("harness error:", err);
  process.exit(2);
});
