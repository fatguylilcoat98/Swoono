import { registerEffect } from "../registries/effectRegistry";
import { useEffectsStore } from "../../state/effectsStore";
import { TROPHY_PRESETS } from "../../components/effects/trophy/presets";

/**
 * Wire every effect handler to the effectsStore. Called once from main.tsx
 * before the React tree mounts.
 *
 * Covers:
 *  - Game outcomes: "effect.game.win" / "effect.game.lose"
 *  - Trophy actions: every id in TROPHY_PRESETS (hug/kiss/hearts/flowers/
 *    slap/punch/kick/pie/banana/confetti/tickle)
 */
export function registerGameEffects() {
  registerEffect("effect.game.win", (payload) => {
    useEffectsStore.getState().pushEffect("effect.game.win", payload.data);
  });
  registerEffect("effect.game.lose", (payload) => {
    useEffectsStore.getState().pushEffect("effect.game.lose", payload.data);
  });

  Object.keys(TROPHY_PRESETS).forEach((effectId) => {
    registerEffect(effectId, (payload) => {
      useEffectsStore.getState().pushEffect(effectId, payload.data);
    });
  });
}
