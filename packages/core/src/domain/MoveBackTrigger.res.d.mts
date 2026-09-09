/** Opaque reducer state for the move-back trigger. */
export type MoveBackTriggerState = unknown;
export type MoveBackTriggerConfig = { windowMs: number };

export const defaults: MoveBackTriggerConfig;
export const initial: MoveBackTriggerState;
/** Returns the initiating move when `move` returns it within the time window. */
export function step(
  state: MoveBackTriggerState,
  move: string,
  timestamp: number,
  config?: MoveBackTriggerConfig,
): [MoveBackTriggerState, string | undefined];
