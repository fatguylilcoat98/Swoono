import { getSocket } from "../socket";

export type EffectPayload = {
  effectId: string;
  fromClientId: string;
  /** Optional: target a specific peer. Undefined = all peers in room. */
  toClientId?: string;
  data?: Record<string, unknown>;
};

export type EffectHandler = (payload: EffectPayload) => void;

const _handlers = new Map<string, EffectHandler>();

export function registerEffect(effectId: string, handler: EffectHandler) {
  _handlers.set(effectId, handler);
}

export function hasEffect(effectId: string): boolean {
  return _handlers.has(effectId);
}

/**
 * Run an effect locally by id. Looks up a registered handler and runs it,
 * or logs a breadcrumb if no handler is registered yet.
 *
 * Use this for SELF-FEEDBACK effects — things that should appear on the
 * current player's screen. Examples: game win/lose celebrations. The
 * winner sees "WINNER" on their screen; the loser sees "LOSER" on theirs.
 *
 * For effects that should appear on the PEER'S screen (reward gestures
 * like kiss / slap / fireworks), use sendEffectToPeer instead — it
 * routes through the server so only the recipient plays the animation.
 */
export function triggerEffect(payload: EffectPayload) {
  const handler = _handlers.get(payload.effectId);
  if (handler) {
    handler(payload);
    return;
  }
  // eslint-disable-next-line no-console
  console.debug("[swoono] effect triggered (no handler yet):", payload);
}

/**
 * Send an effect to the OTHER peer(s) in the room. Does NOT play locally.
 *
 * This is the correct entry point for reward gestures — when A kisses B,
 * the animation should appear on B's screen, not A's. The sender typically
 * shows a small confirmation toast instead of the full effect.
 *
 * Server relay: "effect:send" is handled in server/src/index.ts, which
 * forwards to the room excluding the sender via socket.to(roomCode). The
 * receiving client picks it up via an "effect:receive" listener wired
 * in roomStore.ts, which then calls triggerEffect() locally.
 */
export function sendEffectToPeer(payload: EffectPayload) {
  const socket = getSocket();
  socket.emit("effect:send", payload);
}
