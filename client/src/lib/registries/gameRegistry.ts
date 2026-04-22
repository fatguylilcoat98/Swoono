import type { ComponentType } from "react";
import TicTacToeGame from "../../components/games/modules/tic-tac-toe/TicTacToeGame";
import ConnectFourGame from "../../components/games/modules/connect-four/ConnectFourGame";
import HangmanGame from "../../components/games/modules/hangman/HangmanGame";
import BattleshipGame from "../../components/games/modules/battleship/BattleshipGame";
import DrawingGame from "../../components/games/modules/drawing/DrawingGame";
import NeonStackerGame from "../../components/games/modules/neon-stacker/NeonStackerGame";
import LoveTriviaGame from "../../components/games/modules/love-trivia/LoveTriviaGame";
import TruthOrDareGame from "../../components/games/modules/truth-or-dare/TruthOrDareGame";
import SpicyZoneGame from "../../components/games/modules/spicy-zone/SpicyZoneGame";
import LovingQuestGame from "../../components/games/modules/loving-quest/LovingQuestGame";
import WordChainGame from "../../components/games/modules/word-chain/WordChainGame";
import TriviaGame from "../../components/games/modules/trivia/TriviaGame";
import TugOfWarGame from "../../components/games/modules/tug-of-war/TugOfWarGame";
import MemoryThreadGame from "../../components/games/modules/memory-thread/MemoryThreadGame";
import DailyDareChainGame from "../../components/games/modules/daily-dare-chain/DailyDareChainGame";
import FutureForecastGame from "../../components/games/modules/future-forecast/FutureForecastGame";
import CarePackageGame from "../../components/games/modules/care-package/CarePackageGame";

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
  id: "word-chain",
  name: "Word Chain",
  category: "arcade",
  description:
    "Turn-based word chain. Each word must start with the last letter of the previous. Forfeit loses.",
  emoji: "🔤",
  tier: 0,
  pointsOnWin: 18,
  status: "ready",
  component: WordChainGame,
});

registerGame({
  id: "trivia",
  name: "Trivia",
  category: "arcade",
  description: "Race to the right answer. First tap wins the round. 10 rounds.",
  emoji: "🧠",
  tier: 0,
  pointsOnWin: 20,
  status: "ready",
  component: TriviaGame,
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
  description: "Classic arcade stacker. Time the drop, keep the tower alive, survive each level.",
  emoji: "🧱",
  tier: 0,
  pointsOnWin: 20,
  status: "ready",
  component: NeonStackerGame,
});

// --- Couples ---

registerGame({
  id: "drawing",
  name: "Drawing Together",
  category: "couples",
  description: "Draw the same prompt together, then get judged by our panel of experts!",
  emoji: "🎨",
  tier: 0,
  pointsOnWin: 15,
  status: "ready",
  component: DrawingGame,
});

registerGame({
  id: "truth-or-dare",
  name: "Truth or Dare",
  category: "couples",
  description: "Classic 10-round turn-based. Playful, PG-13.",
  emoji: "💬",
  tier: 0,
  pointsOnWin: 15,
  status: "ready",
  component: TruthOrDareGame,
});

registerGame({
  id: "loving-quest",
  name: "Loving Quest",
  category: "couples",
  description: "Cooperative 6-step experience. No competition, just presence.",
  emoji: "🎯",
  tier: 0,
  pointsOnWin: 15,
  status: "ready",
  component: LovingQuestGame,
});

registerGame({
  id: "love-trivia",
  name: "Couples Trivia",
  category: "couples",
  description:
    "Two phases: predict your partner's answers, then answer for yourself. See how well you two know each other.",
  emoji: "💞",
  tier: 0,
  pointsOnWin: 20,
  status: "ready",
  component: LoveTriviaGame,
});

registerGame({
  id: "spicy-zone",
  name: "Spicy Zone",
  category: "couples",
  description: "18+ prompts. Tasteful, not graphic. 10 rounds.",
  emoji: "🔥",
  tier: 2,
  pointsOnWin: 25,
  status: "ready",
  component: SpicyZoneGame,
});

// --- New Games ---

registerGame({
  id: "tug-of-war",
  name: "Tug of War",
  category: "arcade",
  description: "Real-time tapping battle! First to 80% wins, or most pulls in 30 seconds.",
  emoji: "🪢",
  tier: 0,
  pointsOnWin: 15,
  status: "ready",
  component: TugOfWarGame,
});

registerGame({
  id: "memory-thread",
  name: "Memory Thread",
  category: "couples",
  description: "Build your shared history one memory at a time. Drop a prompt, partner replies.",
  emoji: "📖",
  tier: 0,
  pointsOnWin: 0, // No points, collaborative
  status: "ready",
  component: MemoryThreadGame,
});

registerGame({
  id: "daily-dare-chain",
  name: "Daily Dare Chain",
  category: "couples",
  description: "One dare per day. Escalating tiers. Chain builds until both skip 3 times.",
  emoji: "⛓️",
  tier: 1,
  pointsOnWin: 0, // No points, relationship building
  status: "ready",
  component: DailyDareChainGame,
});

registerGame({
  id: "future-forecast",
  name: "Future Forecast",
  category: "couples",
  description: "Weekly predictions about each other. Submit independently, reveal together.",
  emoji: "🔮",
  tier: 0,
  pointsOnWin: 0, // No points, insight building
  status: "ready",
  component: FutureForecastGame,
});

registerGame({
  id: "care-package",
  name: "Care Package",
  category: "couples",
  description: "Send encouragement packages with delayed delivery. Create when inspired.",
  emoji: "📦",
  tier: 1,
  pointsOnWin: 0, // No points, emotional support
  status: "ready",
  component: CarePackageGame,
});
