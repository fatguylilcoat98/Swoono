import type { ComponentType } from "react";
import TicTacToeGame from "../../components/games/modules/tic-tac-toe/TicTacToeGame";
import ConnectFourGame from "../../components/games/modules/connect-four/ConnectFourGame";
import HangmanGame from "../../components/games/modules/hangman/HangmanGame";
import BattleshipGame from "../../components/games/modules/battleship/BattleshipGame";
import NeonStackerGame from "../../components/games/modules/neon-stacker/NeonStackerGame";
import LoveTriviaGame from "../../components/games/modules/love-trivia/LoveTriviaGame";

export type GameCategory = "arcade" | "couples";

export type GameContextProps = {
  roomCode: string;
  selfClientId: string;
  onExit: () => void;
  onAwardPoints: (delta: number, reason: string) => void;
};

export type GameDefinition = {
  id: string;
  name: string;
  category: GameCategory;
  description: string;
  emoji: string;
  /** Mounted by the game shell when the user starts the game.
   *  Optional for Phase 1 placeholders — leave undefined until the module lands. */
  component?: ComponentType<GameContextProps>;
  /** Tier required to unlock. 0 = free. */
  tier: number;
  /** Rough points awarded on completion. */
  pointsOnWin: number;
  status: "placeholder" | "ready";
};

const _games = new Map<string, GameDefinition>();

export function registerGame(game: GameDefinition) {
  _games.set(game.id, game);
}

export function getGames(): GameDefinition[] {
  return Array.from(_games.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

export function getGamesByCategory(category: GameCategory): GameDefinition[] {
  return getGames().filter((g) => g.category === category);
}

export function getGame(id: string): GameDefinition | undefined {
  return _games.get(id);
}

// --- Seeded game list (ported from Chris's Duo app) ------------------------
// Three games are fully playable (TTT, Connect Four, Hangman). The rest
// are metadata placeholders — their cards render with "coming soon" state
// until a real module lands and sets component + status: "ready".

// --- Arcade ---

registerGame({
  id: "tic-tac-toe",
  name: "Tic-Tac-Toe",
  category: "arcade",
  description: "Classic three-in-a-row. First-to-five for bragging rights.",
  emoji: "⭕",
  tier: 0,
  pointsOnWin: 10,
  status: "ready",
  component: TicTacToeGame,
});

registerGame({
  id: "connect-four",
  name: "Connect Four",
  category: "arcade",
  description: "Drop pieces, line up four, claim the board.",
  emoji: "🔴",
  tier: 0,
  pointsOnWin: 15,
  status: "ready",
  component: ConnectFourGame,
});

registerGame({
  id: "hangman",
  name: "Hangman",
  category: "arcade",
  description: "Guess the word together before the hearts run out.",
  emoji: "📝",
  tier: 0,
  pointsOnWin: 12,
  status: "ready",
  component: HangmanGame,
});

registerGame({
  id: "word-builder",
  name: "Word Builder",
  category: "arcade",
  description: "Make as many valid words as you can, together.",
  emoji: "🔤",
  tier: 0,
  pointsOnWin: 18,
  status: "placeholder",
});

registerGame({
  id: "trivia",
  name: "Trivia",
  category: "arcade",
  description: "Race to the right answer. First tap wins the round.",
  emoji: "🧠",
  tier: 0,
  pointsOnWin: 20,
  status: "placeholder",
});

registerGame({
  id: "battleship",
  name: "Neon Fleet",
  category: "arcade",
  description: "Deluxe 2-player ship combat. Place your fleet, blast theirs.",
  emoji: "🚢",
  tier: 0,
  pointsOnWin: 25,
  status: "ready",
  component: BattleshipGame,
});

registerGame({
  id: "neon-stacker",
  name: "Neon Stacker",
  category: "arcade",
  description: "Physics tower builder. Stack blocks, rotate levels, don't let it fall.",
  emoji: "🧱",
  tier: 0,
  pointsOnWin: 20,
  status: "ready",
  component: NeonStackerGame,
});

// --- Couples ---

registerGame({
  id: "truth-or-dare",
  name: "Truth or Dare",
  category: "couples",
  description: "Playful prompts. Paste your deck and I'll wire them up.",
  emoji: "💬",
  tier: 0,
  pointsOnWin: 15,
  status: "placeholder",
});

registerGame({
  id: "loving-quest",
  name: "Loving Quest",
  category: "couples",
  description: "Shared goals to complete together.",
  emoji: "🎯",
  tier: 0,
  pointsOnWin: 15,
  status: "placeholder",
});

registerGame({
  id: "love-trivia",
  name: "Love Trivia",
  category: "couples",
  description:
    "10 rounds of 'what would your partner pick.' Match to score. Cooperative.",
  emoji: "💭",
  tier: 0,
  pointsOnWin: 20,
  status: "ready",
  component: LoveTriviaGame,
});

registerGame({
  id: "spicy-zone",
  name: "Spicy Zone",
  category: "couples",
  description: "18+ intimate challenges. For the two of you only.",
  emoji: "🔥",
  tier: 2,
  pointsOnWin: 25,
  status: "placeholder",
});
