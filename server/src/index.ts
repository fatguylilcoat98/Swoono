import express from "express";
import http from "http";
import path from "path";
import { Server, Socket } from "socket.io";

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
type ActiveGame = TicTacToeState;

type Room = {
  code: string;
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

  socket.on("join", (payload: JoinPayload, ack?: (res: unknown) => void) => {
    const rawCode = (payload?.code || "").trim().toUpperCase();
    const name = (payload?.name || "").trim().slice(0, 32) || "Anonymous";
    const clientId = payload?.clientId || makeId();

    if (!rawCode) {
      ack?.({ ok: false, error: "Room code required" });
      return;
    }

    const room = getOrCreateRoom(rawCode);

    // Reconnect case: same clientId -> just rebind socket.
    const existing = room.peers.get(clientId);
    if (existing) {
      existing.socketId = socket.id;
      existing.name = name;
    } else if (room.peers.size >= MAX_PEERS_PER_ROOM) {
      ack?.({ ok: false, error: "Room is full (2 people max)" });
      return;
    } else {
      room.peers.set(clientId, { clientId, name, socketId: socket.id });
    }

    joinedCode = rawCode;
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
  });

  socket.on("note:create", (payload: NoteCreatePayload) => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;

    const me = Array.from(room.peers.values()).find(
      (p) => p.socketId === socket.id,
    );
    if (!me) return;

    const text = String(payload?.text || "")
      .trim()
      .slice(0, 280);
    if (!text) return;
    const color = String(payload?.color || "yellow").slice(0, 20);

    const note: Note = {
      id: makeId(),
      roomCode: room.code,
      authorClientId: me.clientId,
      authorName: me.name,
      text,
      color,
      createdAt: Date.now(),
    };

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
    if (room.game && room.game.winner === null) return; // already in play
    if (payload?.gameId !== "tic-tac-toe") return;

    const peerArr = Array.from(room.peers.values());
    if (peerArr.length !== 2) return;

    const me = peerArr.find((p) => p.socketId === socket.id);
    if (!me) return;
    const other = peerArr.find((p) => p.socketId !== socket.id);
    if (!other) return;

    const game: TicTacToeState = {
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
    room.game = game;
    room.lastActivity = Date.now();
    io.to(room.code).emit("game:update", { game });
  });

  socket.on("game:move", (payload: { cellIndex: number }) => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room || !room.game) return;
    const game = room.game;
    if (game.winner !== null) return;
    const cellIndex = payload?.cellIndex;
    if (typeof cellIndex !== "number" || cellIndex < 0 || cellIndex > 8) return;
    if (game.board[cellIndex] !== null) return;

    const me = Array.from(room.peers.values()).find(
      (p) => p.socketId === socket.id,
    );
    if (!me) return;

    const mySide: TicTacToeSide | null =
      game.players.X.clientId === me.clientId
        ? "X"
        : game.players.O.clientId === me.clientId
          ? "O"
          : null;
    if (!mySide) return;
    if (mySide !== game.nextPlayer) return;

    game.board[cellIndex] = mySide;
    const winner = checkTTTWinner(game.board);
    if (winner) {
      game.winner = winner;
    } else {
      game.nextPlayer = mySide === "X" ? "O" : "X";
    }
    room.lastActivity = Date.now();
    io.to(room.code).emit("game:update", { game });
  });

  socket.on("game:exit", () => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    room.game = null;
    io.to(room.code).emit("game:update", { game: null });
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
