import { getSocket } from "../socket";

export type EffectPayload = {
  effectId: string;
  fromClientId: string;
  /** Optional: target a specific peer. Undefined = both sides. */
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
 * Run a local effect by id. In Phase 1 this looks up a registered handler
 * and runs it, or logs a breadcrumb if no handler is registered yet.
 *
 * Plug-in point: call registerEffect("effect.kiss", payload => { ... })
 * from each existing animation component's entry file. That's all the
 * wiring required for reward redemption to play on screen.
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
 * Trigger locally AND ask the server to relay it to the peer. The server
 * relay for "effect:broadcast" is a Phase 2 addition — the emit is a no-op
 * from the server today, so local-only effects still play correctly.
 */
export function broadcastEffect(payload: EffectPayload) {
  triggerEffect(payload);
  const socket = getSocket();
  socket.emit("effect:broadcast", payload);
}
