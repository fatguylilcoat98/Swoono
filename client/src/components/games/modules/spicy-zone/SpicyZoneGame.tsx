import PromptGame from "../prompt-game/PromptGame";
import type { GameContextProps } from "../../../../lib/registries/gameRegistry";

export default function SpicyZoneGame(props: GameContextProps) {
  return (
    <PromptGame
      {...props}
      gameId="spicy-zone"
      title="Spicy Zone"
      subtitle="For the two of you · tasteful, not graphic · 10 rounds"
    />
  );
}
