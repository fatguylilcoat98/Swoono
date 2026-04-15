export type Peer = {
  clientId: string;
  name: string;
};

export type Note = {
  id: string;
  roomCode: string;
  authorClientId: string;
  authorName: string;
  text: string;
  color: string;
  createdAt: number;
};

export type JoinResult =
  | {
      ok: true;
      room: {
        code: string;
        peers: Peer[];
        notes: Note[];
      };
    }
  | { ok: false; error: string };

export type NoteColor = "yellow" | "pink" | "mint" | "lavender" | "peach";

export const NOTE_COLORS: NoteColor[] = [
  "yellow",
  "pink",
  "mint",
  "lavender",
  "peach",
];

export const NOTE_COLOR_STYLES: Record<NoteColor, { bg: string; ink: string }> =
  {
    yellow: { bg: "#fff6a8", ink: "#2a2100" },
    pink: { bg: "#ffc2d8", ink: "#330019" },
    mint: { bg: "#b6f2cf", ink: "#00261a" },
    lavender: { bg: "#d8c8ff", ink: "#1b0a38" },
    peach: { bg: "#ffcdb2", ink: "#2e1700" },
  };

// --- Game state types -----------------------------------------------------

export type TicTacToeSide = "X" | "O";

export type TicTacToePlayerSlot = { clientId: string; name: string };

export type TicTacToeState = {
  gameId: "tic-tac-toe";
  /** length 9 */
  board: (TicTacToeSide | null)[];
  players: {
    X: TicTacToePlayerSlot;
    O: TicTacToePlayerSlot;
  };
  nextPlayer: TicTacToeSide;
  winner: TicTacToeSide | "draw" | null;
  startedAt: number;
};

// --- Connect Four ---

export type ConnectFourSide = "red" | "yellow";

export type ConnectFourState = {
  gameId: "connect-four";
  /** Flat 42-cell board, index = row*7 + col. Row 0 is the top row. */
  board: (ConnectFourSide | null)[];
  players: {
    red: { clientId: string; name: string };
    yellow: { clientId: string; name: string };
  };
  nextPlayer: ConnectFourSide;
  winner: ConnectFourSide | "draw" | null;
  /** Flat-index list of the 4 winning cells, for highlight. */
  winningLine: number[] | null;
  startedAt: number;
};

// --- Hangman (cooperative: both players guess the same word) ---

export type HangmanState = {
  gameId: "hangman";
  /** Lowercase target word. Visible to both clients — cooperative game. */
  word: string;
  /** Letters guessed so far, lowercase, in order. */
  guessedLetters: string[];
  wrongCount: number;
  maxWrong: number;
  /** Index into players[] — whose turn it is. */
  nextPlayerIdx: number;
  players: { clientId: string; name: string }[];
  winner: "win" | "lose" | null;
  startedAt: number;
};

// --- Battleship (Neon Fleet) ---
// Battleship has hidden info: each player only sees their own fleet.
// The server emits a per-player view where opponent ships are scrubbed.

export type BattleshipShipData = {
  name: string;
  len: number;
  x: number;
  y: number;
  vertical: boolean;
  hits: number;
  hitPositions: { x: number; y: number }[];
};

export type BattleshipShot = {
  x: number;
  y: number;
  hit: boolean;
  /** Set only on the shot that caused a ship to sink. */
  sunkShipName: string | null;
};

export type BattleshipState = {
  gameId: "battleship";
  phase: "placement" | "battle" | "done";
  myIdx: 0 | 1;
  myName: string;
  opponentName: string;
  myReady: boolean;
  opponentReady: boolean;
  /** My real fleet, including damage. Authoritative. */
  myShips: BattleshipShipData[];
  /** Shots I fired at the opponent. Drives the targeting grid. */
  myShotsFired: BattleshipShot[];
  /** Shots the opponent fired at my fleet. Drives the fleet-damage display. */
  opponentShotsFired: BattleshipShot[];
  /** Index of the player whose turn it is to fire. */
  turnIdx: 0 | 1;
  winnerIdx: 0 | 1 | null;
  startedAt: number;
};

// --- Neon Stacker (physics tower) ---
// Server tracks whose turn, how many drops per player, level progression.
// The matter.js physics runs client-side — sync happens via deterministic
// replay of the authoritative drop events the server broadcasts.

export type NeonStackerShape = {
  width: number;
  height: number;
  name: string;
};

export type NeonStackerDrop = {
  /** Global drop index, increments on every drop */
  index: number;
  /** Which player (0 or 1) dropped this block */
  playerIdx: 0 | 1;
  /** Crane X position in the canvas at the moment of drop */
  craneX: number;
  /** Crane time (used to reconstruct crane animation phase) */
  craneTime: number;
  /** The block shape chosen for this drop */
  shape: NeonStackerShape;
  /** Server-authoritative timestamp */
  at: number;
};

export type NeonStackerState = {
  gameId: "neon-stacker";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  /** 0 or 1 — whose turn to drop next */
  nextPlayerIdx: 0 | 1;
  /** Total drops so far (both players combined) */
  dropCount: number;
  /** Current level — every 5 drops increments this; base shrinks */
  level: number;
  /** Per-player drop counts (for the leaderboard / stats) */
  playerDropCounts: [number, number];
  /** Winner index, null while game is live */
  winnerIdx: 0 | 1 | null;
  /**
   * Last drop event. When this changes both clients replay it locally
   * through the matter.js engine. The server never simulates physics —
   * clients do, and trust each other's reported physics outcomes.
   */
  lastDrop: NeonStackerDrop | null;
  startedAt: number;
};

/** Union of all game state shapes. Add new games here as they land. */
export type ActiveGame =
  | TicTacToeState
  | ConnectFourState
  | HangmanState
  | BattleshipState
  | NeonStackerState;

// --- Production utility types ---------------------------------------------

export interface ErrorContext {
  component: string;
  action: string;
  data?: unknown;
}

export interface ProductionConfig {
  enableErrorReporting: boolean;
  enableHealthChecks: boolean;
  enableAnalytics: boolean;
  apiEndpoint?: string;
}

export type HealthStatus = 'healthy' | 'warning' | 'error';

export interface SystemCheck {
  name: string;
  status: HealthStatus;
  message: string;
  timestamp: number;
}
