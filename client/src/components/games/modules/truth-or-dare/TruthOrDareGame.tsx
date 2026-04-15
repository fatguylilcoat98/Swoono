import PromptGame from "../prompt-game/PromptGame";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";

export default function TruthOrDareGame(props: GameContextProps) {
  return (
    <PromptGame
      {...props}
      gameId="truth-or-dare"
      title="Truth or Dare"
      subtitle="Playful prompts · 10 rounds"
    />
  );
}
