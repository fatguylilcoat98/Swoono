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

/** Union of all game state shapes. Add new games here as they land. */
export type ActiveGame = TicTacToeState | ConnectFourState | HangmanState;
