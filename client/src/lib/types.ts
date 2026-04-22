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

export type GameRecord = {
  id: string;
  roomCode: string;
  gameId: string;
  winnerClientId: string | null;
  loserClientId: string | null;
  outcome: "win" | "draw" | "coop-win" | "coop-loss";
  startedAt: number;
  finishedAt: number;
};

export type JoinResult =
  | {
      ok: true;
      room: {
        code: string;
        peers: Peer[];
        notes: Note[];
        records?: GameRecord[];
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

// --- Drawing Game ---

export type DrawingStroke = {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  timestamp: number;
};

export type DrawingData = {
  strokes: DrawingStroke[];
  canvasDataUrl?: string; // Base64 screenshot for judging
};

export type DrawingJudge = "fido" | "reginald" | "veloura";

export type JudgeScore = {
  judge: DrawingJudge;
  score: number; // 1-10
  comment: string;
  revealed: boolean;
};

export type DrawingGameState = {
  gameId: "drawing";
  phase: "drawing" | "reveal" | "judging" | "complete";
  prompt: string;
  timeLimit: number; // seconds
  timeRemaining: number; // seconds, server-managed
  players: {
    [clientId: string]: {
      name: string;
      drawing: DrawingData;
      readyForReveal: boolean;
    };
  };
  judgeScores: JudgeScore[];
  currentJudgeIdx: number; // Which judge is revealing (0-2)
  startedAt: number;
};

// --- Prompt game (Truth or Dare / Spicy Zone shared engine) ---

export type PromptType = "truth" | "dare";

export type PromptGameState = {
  gameId: "truth-or-dare" | "spicy-zone";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  /** Whose turn to pick + perform */
  turnIdx: 0 | 1;
  /** The prompt shown right now (null between rounds) */
  currentPrompt: { type: PromptType; text: string } | null;
  /** Rounds completed */
  roundsCompleted: number;
  /** How many rounds total this game */
  totalRounds: number;
  /** "win" once the full game is played */
  winner: "win" | null;
  startedAt: number;
};

// --- Loving Quest (cooperative sequence) ---

export type LovingQuestState = {
  gameId: "loving-quest";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  prompts: string[];
  currentIdx: number;
  /** Both players must tap Done to advance. */
  doneFlags: [boolean, boolean];
  winner: "done" | null;
  startedAt: number;
};

// --- Word Chain (turn-based word linking) ---

export type WordChainEntry = {
  word: string;
  playerIdx: 0 | 1;
};

export type WordChainState = {
  gameId: "word-chain";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  turnIdx: 0 | 1;
  /** Required starting letter for the next word */
  nextLetter: string;
  history: WordChainEntry[];
  /** Winner index (the one who didn't forfeit) */
  winnerIdx: 0 | 1 | null;
  startedAt: number;
};

// --- Trivia (competitive multiple choice race) ---

export type TriviaQuestion = {
  id: string;
  text: string;
  choices: string[];
  /** Index of the correct choice (0-3). Kept on both sides for display. */
  correctIdx: number;
  category?: string;
};

export type TriviaState = {
  gameId: "trivia";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  questions: TriviaQuestion[];
  currentIdx: number;
  /** Players who have already answered (correctly or wrongly) this round */
  lockedOut: [boolean, boolean];
  /** Running scores */
  scores: [number, number];
  /** "win" | "draw" | null */
  winner: "win" | "draw" | null;
  /** Winner index if winner === "win" */
  winnerIdx: 0 | 1 | null;
  startedAt: number;
};

// --- Love Trivia (cooperative couples game) ---

export type LoveTriviaQuestion = {
  id: string;
  text: string;
  choices: string[]; // always length 4
};

/**
 * Newlywed-style two-phase game.
 *
 * Phase 1 — SETUP: each player is shown the same 10 questions and
 * predicts how THEIR PARTNER will answer. Submissions are parallel
 * (no turn-taking).
 *
 * Phase 2 — GAME: each player answers the same 10 questions ABOUT
 * THEMSELVES. Once both have submitted for a round, the round
 * reveals: partner's prediction vs actual, with a match/miss flag.
 *
 * SCORE: a player scores a point each time THEIR prediction about
 * their partner (from setup) matches the partner's actual answer
 * (from game). So `scores[0]` is how well player 0 knows player 1.
 */
export type LoveTriviaState = {
  gameId: "love-trivia";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  phase: "setup" | "game" | "done";
  /** 10 questions selected at game start */
  questions: LoveTriviaQuestion[];
  /** Setup predictions per player — length 10 each, null for unanswered */
  setupPredictions: [(number | null)[], (number | null)[]];
  /** Each player's actual answers about themselves (game phase) */
  gameAnswers: [(number | null)[], (number | null)[]];
  /** Index into questions for the current game-phase round */
  currentIdx: number;
  /** Running scores (player N knowing partner) */
  scores: [number, number];
  /** "done" when all 10 rounds of the game phase have been revealed */
  winner: "done" | null;
  startedAt: number;
};

// --- Neon Stacker (classic arcade stacker, fully server-authoritative) ---
// A crane slides a block back and forth at the top of the playfield.
// The active player taps DROP; the overlap with the block below becomes
// the new block. Miss completely → you lose. Stack 5 blocks → level up.
//
// Everything is computed on the server from the X position reported at
// drop time. No physics, no client-side simulation, so clients can never
// disagree about the stack.

/** A block locked into the tower. All coords are in playfield units. */
export type NeonStackerBlock = {
  /** Center X of the block (playfield coordinates, see FIELD_WIDTH). */
  x: number;
  /** Width of the block in playfield units. */
  width: number;
  /** Which player dropped this block (null for the base platform). */
  playerIdx: 0 | 1 | null;
};

/** The block currently swinging at the top of the screen. */
export type NeonStackerMoving = {
  /** Width of the moving block in playfield units. */
  width: number;
  /** Left edge of the sweep range (center of block can reach this). */
  minX: number;
  /** Right edge of the sweep range. */
  maxX: number;
  /** Sweep speed in playfield units per second. */
  speed: number;
  /** Server Date.now() when this sweep started. */
  startedAt: number;
};

export type NeonStackerState = {
  gameId: "neon-stacker";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  /** Playfield width in logical units (client scales to canvas). */
  fieldWidth: number;
  /** Stack, bottom first. Index 0 is the base platform. */
  stack: NeonStackerBlock[];
  /** The moving block that the next player will drop. */
  moving: NeonStackerMoving | null;
  /** 0 or 1 — whose turn to drop next. */
  nextPlayerIdx: 0 | 1;
  /** Drops within the current level (0..4). Resets on level up. */
  dropsInLevel: number;
  /** Current level, starts at 1. */
  level: number;
  /** Per-player total drops across the whole game. */
  playerDropCounts: [number, number];
  /** Winner index; null while game is live. */
  winnerIdx: 0 | 1 | null;
  /** Short transient banner ("LEVEL 2!") — server clears after a bit. */
  banner: string | null;
  startedAt: number;
};

// --- New games (server-side handlers added 2026-04-22) ---

export type TugOfWarState = {
  gameId: "tug-of-war";
  players: [string, string];
  status: "active" | "finished";
  currentPlayer: string;
  position: number;
  winner: string | null;
  startedAt: number;
};

export type MemoryThreadEntry = {
  author: string;
  text: string;
  timestamp: number;
};

export type MemoryThreadState = {
  gameId: "memory-thread";
  players: [string, string];
  status: "active";
  entries: MemoryThreadEntry[];
  winner: null;
  startedAt: number;
};

export type DareEntry = {
  author: string;
  text: string;
  status: "pending" | "completed" | "skipped";
  timestamp: number;
};

export type DailyDareChainState = {
  gameId: "daily-dare-chain";
  players: [string, string];
  status: "active";
  dares: DareEntry[];
  currentDare: { author: string; text: string; idx: number } | null;
  winner: null;
  startedAt: number;
};

export type FutureForecastState = {
  gameId: "future-forecast";
  players: [string, string];
  status: "active";
  question: string;
  predictions: Record<string, string>;
  votes: Record<string, string>;
  revealed: boolean;
  winner: string | null;
  startedAt: number;
};

export type CarePackageType = "encouragement" | "love" | "support" | "surprise";

export type CarePackageState = {
  gameId: "care-package";
  players: [string, string];
  status: "active";
  package: { sender: string; type: CarePackageType; message: string } | null;
  opened: boolean;
  winner: null;
  startedAt: number;
};

/** Union of all game state shapes. Add new games here as they land. */
export type ActiveGame =
  | TicTacToeState
  | ConnectFourState
  | HangmanState
  | BattleshipState
  | DrawingGameState
  | NeonStackerState
  | LoveTriviaState
  | PromptGameState
  | LovingQuestState
  | WordChainState
  | TugOfWarState
  | MemoryThreadState
  | DailyDareChainState
  | FutureForecastState
  | CarePackageState
  | TriviaState;

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
