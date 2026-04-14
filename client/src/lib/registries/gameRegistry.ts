import type { ComponentType } from "react";

export type GameCategory = "traditional" | "couples";

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

// --- Seeded placeholder games ---------------------------------------------
// Real game modules will replace these once they ship. `component` is
// undefined so the menu renders a "coming soon" card instead of crashing.

registerGame({
  id: "tic-tac-toe",
  name: "Tic-Tac-Toe",
  category: "traditional",
  description: "Classic three-in-a-row. Best of five.",
  emoji: "⭕",
  tier: 0,
  pointsOnWin: 10,
  status: "placeholder",
});

registerGame({
  id: "hangman",
  name: "Hangman",
  category: "traditional",
  description: "Guess the word before the drawing finishes.",
  emoji: "📝",
  tier: 0,
  pointsOnWin: 15,
  status: "placeholder",
});

registerGame({
  id: "battleship",
  name: "Battleship",
  category: "traditional",
  description: "The deluxe version you already built — plugs in here.",
  emoji: "🚢",
  tier: 1,
  pointsOnWin: 25,
  status: "placeholder",
});

registerGame({
  id: "how-well-do-you-know-me",
  name: "How Well Do You Know Me",
  category: "couples",
  description: "Take turns asking each other questions. Guess and win.",
  emoji: "💬",
  tier: 0,
  pointsOnWin: 20,
  status: "placeholder",
});

registerGame({
  id: "truth-or-dare",
  name: "Truth or Dare",
  category: "couples",
  description: "Playful prompts, shared between you two.",
  emoji: "🎲",
  tier: 0,
  pointsOnWin: 15,
  status: "placeholder",
});

registerGame({
  id: "love-trivia",
  name: "Relationship Trivia",
  category: "couples",
  description: "Firsts, favorites, and the little things.",
  emoji: "💘",
  tier: 1,
  pointsOnWin: 20,
  status: "placeholder",
});
