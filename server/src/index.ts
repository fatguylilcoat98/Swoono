import express from "express";
import http from "http";
import path from "path";
import { Server, Socket } from "socket.io";
import {
  isDbConfigured,
  joinRoom as dbJoinRoom,
  touchRoom as dbTouchRoom,
  listNotes as dbListNotes,
  insertNote as dbInsertNote,
  recordPoints as dbRecordPoints,
  recordGame as dbRecordGame,
  logRewardEvent as dbLogRewardEvent,
  updatePeerLocation as dbUpdatePeerLocation,
  listPeerLocations as dbListPeerLocations,
  haversineMeters,
  pointsBalances,
} from "./db";
// ===== INPUT SANITIZATION & SECURITY =====
function sanitizeString(input: string, maxLength = 256): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>&"']/g, (char) => ({
      "<": "&lt;", ">": "&gt;", "&": "&amp;", 
      "\"": "&quot;", "'": "&#x27;"
    }[char] || char))
    .trim().slice(0, maxLength);
}

function sanitizeRoomCode(code: string): string {
  if (!code || typeof code !== "string") return "";
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function sanitizeDisplayName(name: string): string {
  const sanitized = sanitizeString(name, 32);
  return sanitized || "Anonymous";
}


const USE_DB = isDbConfigured();

// Types kept in sync with client/src/lib/types.ts
type Peer = { clientId: string; name: string };

type Note = {
  id: string;
  roomCode: string;
  authorClientId: string;
  authorName: string;
  text: string;
  color: string;
  createdAt: number;
};

// Game state types. Kept in sync with client/src/lib/types.ts.

type TicTacToeSide = "X" | "O";
type TicTacToeState = {
  gameId: "tic-tac-toe";
  board: (TicTacToeSide | null)[];
  players: {
    X: { clientId: string; name: string };
    O: { clientId: string; name: string };
  };
  nextPlayer: TicTacToeSide;
  winner: TicTacToeSide | "draw" | null;
  startedAt: number;
};

type ConnectFourSide = "red" | "yellow";
type ConnectFourState = {
  gameId: "connect-four";
  board: (ConnectFourSide | null)[];
  players: {
    red: { clientId: string; name: string };
    yellow: { clientId: string; name: string };
  };
  nextPlayer: ConnectFourSide;
  winner: ConnectFourSide | "draw" | null;
  winningLine: number[] | null;
  startedAt: number;
};

type HangmanState = {
  gameId: "hangman";
  word: string;
  guessedLetters: string[];
  wrongCount: number;
  maxWrong: number;
  nextPlayerIdx: number;
  players: { clientId: string; name: string }[];
  winner: "win" | "lose" | null;
  startedAt: number;
};

// --- Battleship (Neon Fleet) ---
// Internal state keeps both fleets; per-player views redact the opponent.

type BattleshipShipData = {
  name: string;
  len: number;
  x: number;
  y: number;
  vertical: boolean;
  hits: number;
  hitPositions: { x: number; y: number }[];
};

type BattleshipShot = {
  x: number;
  y: number;
  hit: boolean;
  sunkShipName: string | null;
};

type BattleshipPlayerSlot = {
  clientId: string;
  name: string;
  ships: BattleshipShipData[];
  ready: boolean;
};

type BattleshipInternal = {
  gameId: "battleship";
  phase: "placement" | "battle" | "done";
  players: [BattleshipPlayerSlot, BattleshipPlayerSlot];
  /** shotHistory[i] = shots fired BY player i AT player (1-i) */
  shotHistory: [BattleshipShot[], BattleshipShot[]];
  turnIdx: 0 | 1;
  winnerIdx: 0 | 1 | null;
  startedAt: number;
};

// --- Neon Stacker (physics tower, client-simulated, server-arbitrated) ---

type NeonStackerShape = {
  width: number;
  height: number;
  name: string;
};

type NeonStackerDrop = {
  index: number;
  playerIdx: 0 | 1;
  craneX: number;
  craneTime: number;
  shape: NeonStackerShape;
  at: number;
};

type NeonStackerState = {
  gameId: "neon-stacker";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  nextPlayerIdx: 0 | 1;
  dropCount: number;
  level: number;
  playerDropCounts: [number, number];
  winnerIdx: 0 | 1 | null;
  lastDrop: NeonStackerDrop | null;
  startedAt: number;
};

type ActiveGame =
  | TicTacToeState
  | ConnectFourState
  | HangmanState
  | BattleshipInternal
  | NeonStackerState;

type Room = {
  code: string;
  /** Locked to these two clientIds after the second join. Mirrors DB when USE_DB. */
  owners: string[];
  peers: Map<string, Peer & { socketId: string }>;
  notes: Note[];
  game: ActiveGame | null;
  lastActivity: number;
};

const PORT = Number(process.env.PORT) || 3001;
const MAX_PEERS_PER_ROOM = 2;
const MAX_NOTES_PER_ROOM = 100;
const IDLE_ROOM_MS = 60 * 60 * 1000;

const rooms = new Map<string, Room>();

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getOrCreateRoom(code: string): Room {
  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      owners: [],
      peers: new Map(),
      notes: [],
      game: null,
      lastActivity: Date.now(),
    };
    rooms.set(code, room);
  }
  room.lastActivity = Date.now();
  return room;
}

function publicPeers(room: Room): Peer[] {
  return Array.from(room.peers.values()).map((p) => ({
    clientId: p.clientId,
    name: p.name,
  }));
}

const TTT_WIN_LINES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkTTTWinner(
  board: (TicTacToeSide | null)[],
): TicTacToeSide | "draw" | null {
  for (const [a, b, c] of TTT_WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
}

// --- Connect Four helpers ---
const C4_ROWS = 6;
const C4_COLS = 7;

function dropC4Piece(
  board: (ConnectFourSide | null)[],
  col: number,
  side: ConnectFourSide,
): number | null {
  // Returns the flat index where the piece landed, or null if column full.
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    const idx = r * C4_COLS + col;
    if (board[idx] === null) {
      board[idx] = side;
      return idx;
    }
  }
  return null;
}

function checkC4Winner(board: (ConnectFourSide | null)[]): {
  winner: ConnectFourSide | "draw" | null;
  line: number[] | null;
} {
  const rows = C4_ROWS;
  const cols = C4_COLS;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = board[r * cols + c];
      if (!v) continue;
      // horizontal
      if (
        c + 3 < cols &&
        board[r * cols + c + 1] === v &&
        board[r * cols + c + 2] === v &&
        board[r * cols + c + 3] === v
      ) {
        return {
          winner: v,
          line: [
            r * cols + c,
            r * cols + c + 1,
            r * cols + c + 2,
            r * cols + c + 3,
          ],
        };
      }
      // vertical
      if (
        r + 3 < rows &&
        board[(r + 1) * cols + c] === v &&
        board[(r + 2) * cols + c] === v &&
        board[(r + 3) * cols + c] === v
      ) {
        return {
          winner: v,
          line: [
            r * cols + c,
            (r + 1) * cols + c,
            (r + 2) * cols + c,
            (r + 3) * cols + c,
          ],
        };
      }
      // diag down-right
      if (
        r + 3 < rows &&
        c + 3 < cols &&
        board[(r + 1) * cols + c + 1] === v &&
        board[(r + 2) * cols + c + 2] === v &&
        board[(r + 3) * cols + c + 3] === v
      ) {
        return {
          winner: v,
          line: [
            r * cols + c,
            (r + 1) * cols + c + 1,
            (r + 2) * cols + c + 2,
            (r + 3) * cols + c + 3,
          ],
        };
      }
      // diag down-left
      if (
        r + 3 < rows &&
        c - 3 >= 0 &&
        board[(r + 1) * cols + c - 1] === v &&
        board[(r + 2) * cols + c - 2] === v &&
        board[(r + 3) * cols + c - 3] === v
      ) {
        return {
          winner: v,
          line: [
            r * cols + c,
            (r + 1) * cols + c - 1,
            (r + 2) * cols + c - 2,
            (r + 3) * cols + c - 3,
          ],
        };
      }
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: "draw", line: null };
  }
  return { winner: null, line: null };
}

// --- Hangman helpers ---
const HANGMAN_WORDS = [
  "apple", "banana", "castle", "dragon", "eagle", "forest", "garden",
  "harbor", "island", "jungle", "kitten", "lemon", "meadow", "nebula",
  "ocean", "pepper", "quartz", "ribbon", "sunset", "travel", "unicorn",
  "violet", "wizard", "yellow", "zephyr", "bridge", "coffee", "danger",
  "escape", "flower", "guitar", "honest", "jacket", "ladder", "mirror",
  "napkin", "orange", "puzzle", "rocket", "silver", "tunnel", "velvet",
  "window", "button", "camera", "dinner", "engine", "friend", "giggle",
  "hollow", "insect", "jelly", "knight", "legend", "magnet", "nature",
];

function pickHangmanWord(): string {
  return HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
}

function checkHangmanWin(word: string, guessed: string[]): boolean {
  return word.split("").every((ch) => guessed.includes(ch));
}

// --- Battleship helpers ---
const BS_GRID = 10;
const BS_FLEET_DEF: { name: string; len: number }[] = [
  { name: "CARRIER", len: 5 },
  { name: "BATTLESHIP", len: 4 },
  { name: "CRUISER", len: 3 },
  { name: "SUBMARINE", len: 3 },
  { name: "DESTROYER", len: 2 },
];

function shipCells(
  ship: { x: number; y: number; len: number; vertical: boolean },
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let i = 0; i < ship.len; i++) {
    cells.push({
      x: ship.vertical ? ship.x : ship.x + i,
      y: ship.vertical ? ship.y + i : ship.y,
    });
  }
  return cells;
}

function validateFleetPlacement(
  ships: {
    name: string;
    len: number;
    x: number;
    y: number;
    vertical: boolean;
  }[],
): boolean {
  if (!Array.isArray(ships) || ships.length !== BS_FLEET_DEF.length) return false;
  // Fleet composition must match exactly.
  const expected = [...BS_FLEET_DEF].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const got = [...ships]
    .map((s) => ({ name: s.name, len: s.len }))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].name !== got[i].name || expected[i].len !== got[i].len) {
      return false;
    }
  }
  // Each ship must fit on grid and not overlap.
  const occupied = new Set<string>();
  for (const ship of ships) {
    if (
      !Number.isInteger(ship.x) ||
      !Number.isInteger(ship.y) ||
      typeof ship.vertical !== "boolean"
    ) {
      return false;
    }
    if (ship.x < 0 || ship.y < 0) return false;
    const endX = ship.vertical ? ship.x : ship.x + ship.len - 1;
    const endY = ship.vertical ? ship.y + ship.len - 1 : ship.y;
    if (endX >= BS_GRID || endY >= BS_GRID) return false;
    for (const cell of shipCells(ship)) {
      const key = `${cell.x},${cell.y}`;
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return true;
}

function isGameOver(game: ActiveGame): boolean {
  if (game.gameId === "battleship") return game.winnerIdx !== null;
  if (game.gameId === "neon-stacker") return game.winnerIdx !== null;
  return game.winner !== null;
}

/**
 * Called after a move that ended a game. Writes game_records + points_events.
 * Safe to call when USE_DB is false (becomes a no-op). Never throws — DB
 * failures are logged but must not break the live game flow.
 */
async function persistGameEnd(room: Room, game: ActiveGame, io: Server): Promise<void> {
  if (!USE_DB) return;
  try {
    let winnerClientId: string | null = null;
    let loserClientId: string | null = null;
    let outcome: "win" | "draw" | "coop-win" | "coop-loss" = "win";
    const pointsAwards: { clientId: string; delta: number; reason: string }[] =
      [];

    if (game.gameId === "tic-tac-toe") {
      if (game.winner === "draw") {
        outcome = "draw";
      } else if (game.winner) {
        outcome = "win";
        winnerClientId = game.players[game.winner].clientId;
        loserClientId =
          game.winner === "X"
            ? game.players.O.clientId
            : game.players.X.clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 10,
          reason: "tic-tac-toe win",
        });
      }
    } else if (game.gameId === "connect-four") {
      if (game.winner === "draw") {
        outcome = "draw";
      } else if (game.winner) {
        outcome = "win";
        winnerClientId = game.players[game.winner].clientId;
        loserClientId =
          game.winner === "red"
            ? game.players.yellow.clientId
            : game.players.red.clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 15,
          reason: "connect-four win",
        });
      }
    } else if (game.gameId === "hangman") {
      if (game.winner === "win") {
        outcome = "coop-win";
        // Cooperative — both players get points.
        for (const p of game.players) {
          pointsAwards.push({
            clientId: p.clientId,
            delta: 12,
            reason: "hangman win",
          });
        }
      } else if (game.winner === "lose") {
        outcome = "coop-loss";
      }
    } else if (game.gameId === "battleship") {
      if (game.winnerIdx !== null) {
        outcome = "win";
        winnerClientId = game.players[game.winnerIdx].clientId;
        loserClientId =
          game.winnerIdx === 0
            ? game.players[1].clientId
            : game.players[0].clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 25,
          reason: "neon-fleet win",
        });
      }
    } else if (game.gameId === "neon-stacker") {
      if (game.winnerIdx !== null) {
        outcome = "win";
        winnerClientId = game.players[game.winnerIdx].clientId;
        loserClientId =
          game.winnerIdx === 0
            ? game.players[1].clientId
            : game.players[0].clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 20,
          reason: "neon-stacker win",
        });
      }
    }

    await dbRecordGame({
      room_code: room.code,
      game_id: game.gameId,
      winner_client_id: winnerClientId,
      loser_client_id: loserClientId,
      outcome,
      started_at: new Date(game.startedAt).toISOString(),
      meta: null,
    });

    for (const award of pointsAwards) {
      await dbRecordPoints(
        room.code,
        award.clientId,
        award.delta,
        award.reason,
      );
    }

    // Sync updated points to all clients in the room after awarding points
    if (pointsAwards.length > 0) {
      try {
        const balances = await pointsBalances(room.code);
        for (const [clientId, peer] of room.peers) {
          const currentPoints = balances[clientId] || 0;
          io.to(room.code).emit("points:sync", { 
            clientId: clientId, 
            points: currentPoints 
          });
        }
      } catch (err) {
        console.error("[swoono] points sync error:", err);
      }
    }
  } catch (err) {
    console.error("[swoono] persistGameEnd error:", err);
  }
}

function buildBattleshipViewFor(
  game: BattleshipInternal,
  myIdx: 0 | 1,
): {
  gameId: "battleship";
  phase: "placement" | "battle" | "done";
  myIdx: 0 | 1;
  myName: string;
  opponentName: string;
  myReady: boolean;
  opponentReady: boolean;
  myShips: BattleshipShipData[];
  myShotsFired: BattleshipShot[];
  opponentShotsFired: BattleshipShot[];
  turnIdx: 0 | 1;
  winnerIdx: 0 | 1 | null;
  startedAt: number;
} {
  const oppIdx: 0 | 1 = myIdx === 0 ? 1 : 0;
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];
  return {
    gameId: "battleship",
    phase: game.phase,
    myIdx,
    myName: me.name,
    opponentName: opp.name,
    myReady: me.ready,
    opponentReady: opp.ready,
    myShips: me.ships,
    myShotsFired: game.shotHistory[myIdx],
    opponentShotsFired: game.shotHistory[oppIdx],
    turnIdx: game.turnIdx,
    winnerIdx: game.winnerIdx,
    startedAt: game.startedAt,
  };
}

function emitGameUpdate(room: Room) {
  const game = room.game;
  if (!game) {
    io.to(room.code).emit("game:update", { game: null });
    return;
  }
  if (game.gameId === "battleship") {
    // Per-player redacted views.
    for (const peer of room.peers.values()) {
      const idx: 0 | 1 =
        game.players[0].clientId === peer.clientId ? 0 : 1;
      const view = buildBattleshipViewFor(game, idx);
      io.to(peer.socketId).emit("game:update", { game: view });
    }
    return;
  }
  io.to(room.code).emit("game:update", { game });
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Serve the built Vite client. server/dist/index.js -> ../../client/dist.
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size,
    uptime: process.uptime(),
  });
});

// SPA catch-all for client-side routing (must come after API routes).
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

type JoinPayload = { code: string; name: string; clientId: string };
type NoteCreatePayload = { text: string; color: string };

io.on("connection", (socket: Socket) => {
  let joinedCode: string | null = null;
  let joinedClientId: string | null = null;

  socket.on("join", async (payload: JoinPayload, ack?: (res: unknown) => void) => {
    const rawCode = sanitizeRoomCode(payload?.code || "");
    const name = sanitizeDisplayName(payload?.name || "");
    const clientId = payload?.clientId || makeId();

    if (!rawCode) {
      ack?.({ ok: false, error: "Room code required" });
      return;
    }

    const room = getOrCreateRoom(rawCode);

    if (USE_DB) {
      // Persistent path: authoritative ownership + notes live in Supabase.
      try {
        const { room: dbRoom } = await dbJoinRoom(rawCode, clientId, name);
        room.owners = dbRoom.owner_client_ids || [];
        // Load notes from DB into in-memory cache so existing code paths work.
        const dbNotes = await dbListNotes(rawCode, MAX_NOTES_PER_ROOM);
        room.notes = dbNotes.map((n) => ({
          id: n.id,
          roomCode: n.room_code,
          authorClientId: n.author_client_id,
          authorName: n.author_name,
          text: n.body,
          color: n.color,
          createdAt: new Date(n.created_at).getTime(),
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "room_locked") {
          ack?.({
            ok: false,
            error: "Room is full (2 players maximum)",
          });
          return;
        }
        console.error("[swoono] join DB error:", err);
        ack?.({ ok: false, error: "Server error joining room" });
        return;
      }
    } else {
      // In-memory fallback (dev mode). Lock to the first two clientIds.
      if (!room.owners.includes(clientId)) {
        if (room.owners.length >= MAX_PEERS_PER_ROOM) {
          ack?.({
            ok: false,
            error: "Room is full (2 players maximum)",
          });
          return;
        }
        room.owners.push(clientId);
      }
    }

    // Rebind / add socket for the peer.
    const existing = room.peers.get(clientId);
    if (existing) {
      existing.socketId = socket.id;
      existing.name = name;
    } else {
      room.peers.set(clientId, { clientId, name, socketId: socket.id });
    }

    joinedCode = rawCode;
    joinedClientId = clientId;
    socket.join(rawCode);

    ack?.({
      ok: true,
      room: {
        code: rawCode,
        peers: publicPeers(room),
        notes: room.notes,
      },
    });

    io.to(rawCode).emit("presence", { peers: publicPeers(room) });

    // Sync current points to the joining client
    if (USE_DB) {
      try {
        const balances = await pointsBalances(rawCode);
        const clientPoints = balances[clientId] || 0;
        socket.emit("points:sync", { clientId, points: clientPoints });
      } catch (err) {
        console.error("[swoono] join points sync error:", err);
      }
    }

    // If a game is already in progress (player rejoining), send them its state.
    if (room.game) {
      emitGameUpdate(room);
    }
  });

  socket.on("note:create", async (payload: NoteCreatePayload) => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;

    const me = Array.from(room.peers.values()).find(
      (p) => p.socketId === socket.id,
    );
    if (!me) return;

    const text = sanitizeString(payload?.text || "", 500);
    if (!text.trim()) return;
    const color = sanitizeString(payload?.color || "yellow", 20);

    let note: Note;

    if (USE_DB) {
      try {
        const row = await dbInsertNote({
          room_code: room.code,
          author_client_id: me.clientId,
          author_name: me.name,
          body: text,
          color,
        });
        note = {
          id: row.id,
          roomCode: row.room_code,
          authorClientId: row.author_client_id,
          authorName: row.author_name,
          text: row.body,
          color: row.color,
          createdAt: new Date(row.created_at).getTime(),
        };
        await dbTouchRoom(room.code);
      } catch (err) {
        console.error("[swoono] note:create DB error:", err);
        return;
      }
    } else {
      note = {
        id: makeId(),
        roomCode: room.code,
        authorClientId: me.clientId,
        authorName: me.name,
        text,
        color,
        createdAt: Date.now(),
      };
    }

    room.notes.push(note);
    if (room.notes.length > MAX_NOTES_PER_ROOM) {
      room.notes.splice(0, room.notes.length - MAX_NOTES_PER_ROOM);
    }
    room.lastActivity = Date.now();

    io.to(room.code).emit("note:new", note);
  });

  // -- Games ---------------------------------------------------------------
  socket.on("game:start", (payload: { gameId: string }) => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    if (room.game && !isGameOver(room.game)) return; // already in play

    const peerArr = Array.from(room.peers.values());
    if (peerArr.length !== 2) return;

    const me = peerArr.find((p) => p.socketId === socket.id);
    if (!me) return;
    const other = peerArr.find((p) => p.socketId !== socket.id);
    if (!other) return;

    const gameId = payload?.gameId;
    let game: ActiveGame | null = null;

    if (gameId === "tic-tac-toe") {
      game = {
        gameId: "tic-tac-toe",
        board: Array(9).fill(null),
        players: {
          X: { clientId: me.clientId, name: me.name },
          O: { clientId: other.clientId, name: other.name },
        },
        nextPlayer: "X",
        winner: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "connect-four") {
      game = {
        gameId: "connect-four",
        board: Array(C4_ROWS * C4_COLS).fill(null),
        players: {
          red: { clientId: me.clientId, name: me.name },
          yellow: { clientId: other.clientId, name: other.name },
        },
        nextPlayer: "red",
        winner: null,
        winningLine: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "hangman") {
      game = {
        gameId: "hangman",
        word: pickHangmanWord(),
        guessedLetters: [],
        wrongCount: 0,
        maxWrong: 6,
        nextPlayerIdx: 0,
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        winner: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "battleship") {
      game = {
        gameId: "battleship",
        phase: "placement",
        players: [
          {
            clientId: me.clientId,
            name: me.name,
            ships: [],
            ready: false,
          },
          {
            clientId: other.clientId,
            name: other.name,
            ships: [],
            ready: false,
          },
        ],
        shotHistory: [[], []],
        turnIdx: 0,
        winnerIdx: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "neon-stacker") {
      game = {
        gameId: "neon-stacker",
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        nextPlayerIdx: 0,
        dropCount: 0,
        level: 1,
        playerDropCounts: [0, 0],
        winnerIdx: null,
        lastDrop: null,
        startedAt: Date.now(),
      };
    } else {
      return; // unknown game id
    }

    room.game = game;
    room.lastActivity = Date.now();
    emitGameUpdate(room);
  });

  socket.on(
    "game:move",
    (payload: {
      cellIndex?: number;
      column?: number;
      letter?: string;
      action?: "place" | "fire" | "drop" | "reportGameOver";
      ships?: {
        name: string;
        len: number;
        x: number;
        y: number;
        vertical: boolean;
      }[];
      x?: number;
      y?: number;
      // neon-stacker drop
      craneX?: number;
      craneTime?: number;
      shape?: { width: number; height: number; name: string };
      // neon-stacker reportGameOver
      loserIdx?: 0 | 1;
    }) => {
      if (!joinedCode) return;
      const room = rooms.get(joinedCode);
      if (!room || !room.game) return;
      const game = room.game;
      if (isGameOver(game)) return;

      const me = Array.from(room.peers.values()).find(
        (p) => p.socketId === socket.id,
      );
      if (!me) return;

      let changed = false;

      if (game.gameId === "tic-tac-toe") {
        const cellIndex = payload?.cellIndex;
        if (
          typeof cellIndex !== "number" ||
          cellIndex < 0 ||
          cellIndex > 8
        )
          return;
        if (game.board[cellIndex] !== null) return;

        const mySide: TicTacToeSide | null =
          game.players.X.clientId === me.clientId
            ? "X"
            : game.players.O.clientId === me.clientId
              ? "O"
              : null;
        if (!mySide || mySide !== game.nextPlayer) return;

        game.board[cellIndex] = mySide;
        const winner = checkTTTWinner(game.board);
        if (winner) {
          game.winner = winner;
        } else {
          game.nextPlayer = mySide === "X" ? "O" : "X";
        }
        changed = true;
      } else if (game.gameId === "connect-four") {
        const col = payload?.column;
        if (typeof col !== "number" || col < 0 || col >= C4_COLS) return;

        const mySide: ConnectFourSide | null =
          game.players.red.clientId === me.clientId
            ? "red"
            : game.players.yellow.clientId === me.clientId
              ? "yellow"
              : null;
        if (!mySide || mySide !== game.nextPlayer) return;

        const landedIdx = dropC4Piece(game.board, col, mySide);
        if (landedIdx === null) return; // column full

        const result = checkC4Winner(game.board);
        if (result.winner) {
          game.winner = result.winner;
          game.winningLine = result.line;
        } else {
          game.nextPlayer = mySide === "red" ? "yellow" : "red";
        }
        changed = true;
      } else if (game.gameId === "battleship") {
        const myIdx: 0 | 1 | null =
          game.players[0].clientId === me.clientId
            ? 0
            : game.players[1].clientId === me.clientId
              ? 1
              : null;
        if (myIdx === null) return;
        const oppIdx: 0 | 1 = myIdx === 0 ? 1 : 0;

        if (payload?.action === "place") {
          if (game.phase !== "placement") return;
          if (game.players[myIdx].ready) return;
          const rawShips = payload.ships || [];
          if (!validateFleetPlacement(rawShips)) return;
          game.players[myIdx].ships = rawShips.map((s) => ({
            name: s.name,
            len: s.len,
            x: s.x,
            y: s.y,
            vertical: s.vertical,
            hits: 0,
            hitPositions: [],
          }));
          game.players[myIdx].ready = true;
          if (game.players[0].ready && game.players[1].ready) {
            game.phase = "battle";
            game.turnIdx = Math.random() < 0.5 ? 0 : 1;
          }
          changed = true;
        } else if (payload?.action === "fire") {
          if (game.phase !== "battle") return;
          if (game.turnIdx !== myIdx) return;
          const x = payload.x;
          const y = payload.y;
          if (
            typeof x !== "number" ||
            typeof y !== "number" ||
            x < 0 ||
            x >= BS_GRID ||
            y < 0 ||
            y >= BS_GRID
          )
            return;
          // No double-fire on the same cell.
          if (
            game.shotHistory[myIdx].some((s) => s.x === x && s.y === y)
          )
            return;
          // Resolve against opponent fleet.
          const oppShips = game.players[oppIdx].ships;
          let hitShip: BattleshipShipData | null = null;
          for (const ship of oppShips) {
            for (const cell of shipCells(ship)) {
              if (cell.x === x && cell.y === y) {
                hitShip = ship;
                break;
              }
            }
            if (hitShip) break;
          }
          let sunkShipName: string | null = null;
          if (hitShip) {
            hitShip.hits++;
            hitShip.hitPositions.push({ x, y });
            if (hitShip.hits >= hitShip.len) {
              sunkShipName = hitShip.name;
            }
          }
          game.shotHistory[myIdx].push({
            x,
            y,
            hit: !!hitShip,
            sunkShipName,
          });
          // Check win.
          const allSunk = oppShips.every((s) => s.hits >= s.len);
          if (allSunk) {
            game.phase = "done";
            game.winnerIdx = myIdx;
          } else {
            game.turnIdx = oppIdx;
          }
          changed = true;
        }
      } else if (game.gameId === "neon-stacker") {
        const myIdx: 0 | 1 | null =
          game.players[0].clientId === me.clientId
            ? 0
            : game.players[1].clientId === me.clientId
              ? 1
              : null;
        if (myIdx === null) return;

        if (payload?.action === "drop") {
          if (game.nextPlayerIdx !== myIdx) return;
          const craneX = payload.craneX;
          const craneTime = payload.craneTime;
          const shape = payload.shape;
          if (
            typeof craneX !== "number" ||
            typeof craneTime !== "number" ||
            !shape ||
            typeof shape.width !== "number" ||
            typeof shape.height !== "number" ||
            typeof shape.name !== "string"
          ) {
            return;
          }
          game.dropCount += 1;
          game.playerDropCounts[myIdx] += 1;
          // Level up every 5 drops — matches Chris's spec.
          if (game.dropCount > 0 && game.dropCount % 5 === 0) {
            game.level += 1;
          }
          game.lastDrop = {
            index: game.dropCount,
            playerIdx: myIdx,
            craneX,
            craneTime,
            shape: {
              width: shape.width,
              height: shape.height,
              name: shape.name,
            },
            at: Date.now(),
          };
          game.nextPlayerIdx = myIdx === 0 ? 1 : 0;
          changed = true;
        } else if (payload?.action === "reportGameOver") {
          // Client-reported game over. The loser is whoever made the
          // last drop — their block caused the tower to collapse.
          // Both clients may report concurrently; the winnerIdx guard
          // below makes this idempotent so only the first one wins.
          if (game.winnerIdx !== null) return; // already ended
          if (!game.lastDrop) return;
          const loserIdx = game.lastDrop.playerIdx;
          game.winnerIdx = loserIdx === 0 ? 1 : 0;
          changed = true;
        }
      } else if (game.gameId === "hangman") {
        const letter = String(payload?.letter || "").toLowerCase();
        if (!/^[a-z]$/.test(letter)) return;
        if (game.guessedLetters.includes(letter)) return;

        const currentPlayer = game.players[game.nextPlayerIdx];
        if (!currentPlayer || currentPlayer.clientId !== me.clientId) return;

        game.guessedLetters.push(letter);
        if (!game.word.includes(letter)) {
          game.wrongCount++;
        }
        if (game.wrongCount >= game.maxWrong) {
          game.winner = "lose";
        } else if (checkHangmanWin(game.word, game.guessedLetters)) {
          game.winner = "win";
        } else {
          game.nextPlayerIdx =
            (game.nextPlayerIdx + 1) % game.players.length;
        }
        changed = true;
      }

      if (changed) {
        room.lastActivity = Date.now();
        emitGameUpdate(room);
        // If this move ended the game, persist the record + points.
        if (isGameOver(game)) {
          void persistGameEnd(room, game, io);
        }
      }
    },
  );

  socket.on("game:exit", () => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    room.game = null;
    emitGameUpdate(room);
  });

  // -- Reward effect relay -------------------------------------------------
  // A sends an effect (kiss, slap, fireworks) → server forwards to the
  // OTHER peers in the room, stamped with the sender's name. Sender never
  // receives their own effect back — they show a toast on the client side.
  socket.on(
    "effect:send",
    async (payload: {
      effectId?: string;
      data?: Record<string, unknown>;
    }) => {
      if (!joinedCode) return;
      const room = rooms.get(joinedCode);
      if (!room) return;
      const effectId = typeof payload?.effectId === "string" ? payload.effectId : "";
      if (!effectId) return;

      const me = Array.from(room.peers.values()).find(
        (p) => p.socketId === socket.id,
      );
      if (!me) return;

      // Resolve the recipient (the other peer).
      const other = Array.from(room.peers.values()).find(
        (p) => p.socketId !== socket.id,
      );
      const toClientId = other?.clientId || "";

      const forwarded = {
        effectId,
        fromClientId: me.clientId,
        data: {
          ...(payload.data || {}),
          fromName: me.name,
        },
      };
      // socket.to() excludes the sender automatically.
      socket.to(room.code).emit("effect:receive", forwarded);

      if (USE_DB && toClientId) {
        try {
          await dbLogRewardEvent({
            room_code: room.code,
            from_client_id: me.clientId,
            to_client_id: toClientId,
            effect_id: effectId,
            payload: payload.data || null,
            delivered: true, // we just pushed it; only matters for offline retries
          });
        } catch (err) {
          console.error("[swoono] effect:send log error:", err);
        }
      }
    },
  );

  // -- Distance apart ------------------------------------------------------
  // Clients push their coarse location. Server stores lat/lng in DB and
  // broadcasts the haversine distance to both peers. Raw coordinates never
  // leave the server — only the computed distance.
  socket.on(
    "location:update",
    async (payload: { lat?: number; lng?: number; accuracyM?: number }) => {
      if (!joinedCode) return;
      const room = rooms.get(joinedCode);
      if (!room) return;

      const me = Array.from(room.peers.values()).find(
        (p) => p.socketId === socket.id,
      );
      if (!me) return;

      const lat = payload?.lat;
      const lng = payload?.lng;
      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return;
      }

      if (!USE_DB) return; // distance needs persistence for both peers

      try {
        await dbUpdatePeerLocation(
          room.code,
          me.clientId,
          lat,
          lng,
          typeof payload.accuracyM === "number" ? payload.accuracyM : undefined,
        );
        const locs = await dbListPeerLocations(room.code);
        if (locs.length === 2) {
          const [a, b] = locs;
          const meters = haversineMeters(a.lat, a.lng, b.lat, b.lng);
          io.to(room.code).emit("distance:update", {
            meters,
            updatedAt: Date.now(),
          });
        }
      } catch (err) {
        console.error("[swoono] location:update error:", err);
      }
    },
  );


  socket.on("points:get", async (ack?: (res: { points: number }) => void) => {
    if (!joinedCode || !USE_DB) {
      ack?.({ points: 0 });
      return;
    }
    
    try {
      const balances = await pointsBalances(joinedCode);
      const points = joinedClientId ? (balances[joinedClientId] || 0) : 0;
      ack?.({ points });
    } catch (err) {
      console.error("[swoono] points:get error:", err);
      ack?.({ points: 0 });
    }
  });
  socket.on("disconnect", () => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;

    for (const [clientId, peer] of room.peers) {
      if (peer.socketId === socket.id) {
        room.peers.delete(clientId);
        break;
      }
    }

    if (room.peers.size > 0) {
      io.to(joinedCode).emit("presence", { peers: publicPeers(room) });
    }
  });
});

// Sweep empty idle rooms.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.peers.size === 0 && now - room.lastActivity > IDLE_ROOM_MS) {
      rooms.delete(code);
    }
  }
}, 60_000);

server.listen(PORT, () => {
  console.log(`[swoono] listening on :${PORT}`);
});
