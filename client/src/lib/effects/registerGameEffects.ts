import { registerEffect } from "../registries/effectRegistry";
import { useEffectsStore } from "../../state/effectsStore";

/**
 * Wires the "effect.game.win" and "effect.game.lose" effectRegistry
 * handlers to the effectsStore. Called once from main.tsx before the
 * React tree mounts.
 *
 * This is the integration pattern for ALL future reward animations:
 *   registerEffect("effect.kiss", payload => {
 *     useEffectsStore.getState().pushEffect("effect.kiss", payload.data);
 *   });
 * Then add a switch case in EffectOverlay.tsx.
 */
export function registerGameEffects() {
  registerEffect("effect.game.win", (payload) => {
    useEffectsStore.getState().pushEffect("effect.game.win", payload.data);
  });
  registerEffect("effect.game.lose", (payload) => {
    useEffectsStore.getState().pushEffect("effect.game.lose", payload.data);
  });
}
