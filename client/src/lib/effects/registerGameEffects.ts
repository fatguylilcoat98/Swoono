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
 *  - New reward animations: floating_hearts, rose_shower, ghost_mode, etc.
 */
export function registerGameEffects() {
  registerEffect("effect.game.win", (payload) => {
    useEffectsStore.getState().pushEffect("effect.game.win", payload.data);
  });
  registerEffect("effect.game.lose", (payload) => {
    useEffectsStore.getState().pushEffect("effect.game.lose", payload.data);
  });

  // Fireworks — premium reward, its own standalone component (not via TrophyBurst)
  registerEffect("effect.fireworks", (payload) => {
    useEffectsStore.getState().pushEffect("effect.fireworks", payload.data);
  });

  // New reward animations — Sweet tier
  registerEffect("floating_hearts", (payload) => {
    useEffectsStore.getState().pushEffect("floating_hearts", payload.data);
  });
  registerEffect("rose_shower", (payload) => {
    useEffectsStore.getState().pushEffect("rose_shower", payload.data);
  });

  // New reward animations — Savage tier
  registerEffect("ghost_mode", (payload) => {
    useEffectsStore.getState().pushEffect("ghost_mode", payload.data);
  });
  registerEffect("roast_card", (payload) => {
    useEffectsStore.getState().pushEffect("roast_card", payload.data);
  });
  registerEffect("prank_alarm", (payload) => {
    useEffectsStore.getState().pushEffect("prank_alarm", payload.data);
  });

  // New reward animations — Legendary tier
  registerEffect("confetti_cannon", (payload) => {
    useEffectsStore.getState().pushEffect("confetti_cannon", payload.data);
  });
  registerEffect("love_bomb", (payload) => {
    useEffectsStore.getState().pushEffect("love_bomb", payload.data);
  });

  // New reward animations — Milestone tier
  registerEffect("proposal", (payload) => {
    useEffectsStore.getState().pushEffect("proposal", payload.data);
  });
  registerEffect("anniversary", (payload) => {
    useEffectsStore.getState().pushEffect("anniversary", payload.data);
  });
  registerEffect("i_love_you", (payload) => {
    useEffectsStore.getState().pushEffect("i_love_you", payload.data);
  });
  registerEffect("meet_up", (payload) => {
    useEffectsStore.getState().pushEffect("meet_up", payload.data);
  });

  Object.keys(TROPHY_PRESETS).forEach((effectId) => {
    registerEffect(effectId, (payload) => {
      useEffectsStore.getState().pushEffect(effectId, payload.data);
    });
  });
}
