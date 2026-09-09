export type MoveBackTrigger = unknown;
export type MoveBackTriggerConfig = { windowMs: number };

export const defaults: MoveBackTriggerConfig;
export function make(config?: MoveBackTriggerConfig): MoveBackTrigger;
export function reset(detector: MoveBackTrigger): void;
/** Returns the initiating move when `move` returns it within the time window. */
export function observe(detector: MoveBackTrigger, move: string, timestamp: number): string | undefined;
