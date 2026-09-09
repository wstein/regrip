/** Opaque pure cursor state for timestamp-ordered replay. */
export type ReplayCursorState = unknown;

export const initial: ReplayCursorState;
export function reset(state: ReplayCursorState): ReplayCursorState;
export function position(state: ReplayCursorState): number;
export function virtualNowMs(state: ReplayCursorState): number;
export function done(state: ReplayCursorState, timestamps: readonly number[]): boolean;
/** Clamp an event index and derive virtual time from its preceding event. */
export function seekTo(timestamps: readonly number[], index: number): ReplayCursorState;
/** Emit exactly one next event index. */
export function stepOne(
  state: ReplayCursorState,
  timestamps: readonly number[],
): [ReplayCursorState, number | undefined];
/** Emit all next event indices whose timestamps are at or before `targetMs`. */
export function advanceTo(
  state: ReplayCursorState,
  timestamps: readonly number[],
  targetMs: number,
): [ReplayCursorState, number[]];
